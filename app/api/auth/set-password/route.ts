/**
 * POST /api/auth/set-password
 *
 * Allows authenticated users (including Google-only users) to create or change their website password.
 *
 * Flow:
 * 1. Verify user is authenticated (session required)
 * 2. Validate new password strength
 * 3. If user already has a password, require old password
 * 4. Hash new password using bcrypt
 * 5. Update user record:
 *    - passwordHash = bcrypt(newPassword)
 *    - hasPassword = true
 *    - passwordChangedAt = NOW()
 * 6. Old sessions are invalidated automatically via passwordChangedAt in JWT callback
 * 7. Return success
 *
 * IMPORTANT:
 * - NEVER creates a new user
 * - NEVER duplicates accounts
 * - Updates ONLY the authenticated user's existing record
 * - This is the ONLY way Google users can add a website password
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db-server";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { validatePassword } from "@/lib/authValidation";

export async function POST(request: NextRequest) {
  try {
    // Step 1: Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body
    const body = await request.json();
    const raw = body as {
      currentPassword?: string;
      newPassword: string;
    };

    const currentPassword = raw.currentPassword ?? "";
    const newPassword = raw.newPassword ?? "";

    // Step 2: Validate new password
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return NextResponse.json(
        { success: false, message: passwordError },
        { status: 400 }
      );
    }

    // Step 3: Check if user already has a password
    const user = await db
      .select({
        hasPassword: users.hasPassword,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 500 }
      );
    }

    const userRecord = user[0];

    // If user already has a password, require current password for verification
    if (userRecord.hasPassword && userRecord.passwordHash) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, message: "Current password required to change password" },
          { status: 400 }
        );
      }

      // Verify current password matches
      const bcryptLib = await import("bcryptjs");
      const isValid = await bcryptLib.compare(currentPassword, userRecord.passwordHash);
      if (!isValid) {
        return NextResponse.json(
          { success: false, message: "Current password is incorrect" },
          { status: 401 }
        );
      }
    }

    // Step 4: Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Step 5: Update user record (ONLY this user, NEVER creates new)
    const now = new Date();
    await db
      .update(users)
      .set({
        passwordHash,
        hasPassword: true,
        passwordChangedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    // Step 6: Old JWT sessions will be invalidated automatically
    // via the passwordChangedAt check in the JWT callback (auth.ts)

    return NextResponse.json(
      {
        success: true,
        message: userRecord.hasPassword
          ? "Password changed successfully."
          : "Website password created successfully. You can now log in with your email and password.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[SET_PASSWORD_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";