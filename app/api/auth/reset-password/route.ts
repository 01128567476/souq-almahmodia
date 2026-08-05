/**
 * POST /api/auth/reset-password
 *
 * Step 2 of OTP-based password reset flow.
 * Verifies the OTP code and sets a new password.
 *
 * This endpoint handles two scenarios:
 * 1. Regular password reset (user has password, forgot it)
 * 2. First password creation (Google-only user creates password)
 *
 * Request body:
 * - email: string (user's email)
 * - otp: string (6-digit OTP code)
 * - newPassword: string (new password)
 *
 * Response:
 * - success: boolean
 * - message: string
 *
 * Security:
 * - OTP must be valid, unexpired, and unused
 * - Maximum 3 verification attempts per OTP
 * - Password is bcrypt hashed before storage
 * - OTP is deleted after successful reset
 * - Sessions are invalidated after password reset
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-server";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { userRepository } from "@/services/repositories/userRepository";
import { verifyOtpCode, consumeOtpToken } from "@/services/repositories/otpRepository";

/** Password minimum length */
const MIN_PASSWORD_LENGTH = 8;

/** Password strength requirements */
function validatePassword(password: string): string | null {
  if (!password) return "Password is required";
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp, newPassword } = body as {
      email?: string;
      otp?: string;
      newPassword?: string;
    };

    // Validate inputs
    if (!email || !otp || !newPassword) {
      return NextResponse.json(
        { success: false, message: "Email, OTP, and new password are required" },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return NextResponse.json(
        { success: false, message: passwordError },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email
    const user = await userRepository.getByEmail(normalizedEmail);
    // Generic error to prevent user enumeration
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Invalid OTP code" },
        { status: 400 }
      );
    }

    // Verify the OTP code (checks expiration, max attempts)
    const verifyResult = await verifyOtpCode(user.id, otp, "email");
    if (!verifyResult.success) {
      return NextResponse.json(
        { success: false, message: verifyResult.error || "Invalid OTP code" },
        { status: 400 }
      );
    }

    // Consume the OTP (one-time use - invalidates after use)
    const consumeResult = await consumeOtpToken(user.id, otp, "email");
    if (!consumeResult.success) {
      return NextResponse.json(
        { success: false, message: consumeResult.error || "OTP verification failed" },
        { status: 400 }
      );
    }

    // Update password within a transaction
    const result = await db.transaction(async (tx) => {
      // Hash the new password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);
         const now = new Date();

 // Update user password, set hasPassword to true, AND set passwordChangedAt
      // This enables BOTH Google OAuth AND email/password login
      // passwordChangedAt triggers JWT session invalidation on next request
      await tx
        .update(users)
        .set({
          passwordHash,
          hasPassword: true,
          passwordChangedAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, user.id));

      return { success: true };
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: "Password reset failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. You can now sign in with your new password.",
    });
  } catch (error) {
    console.error("[RESET_PASSWORD_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Password reset failed" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";