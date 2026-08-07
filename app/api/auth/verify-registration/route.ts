/**
 * POST /api/auth/verify-registration
 *
 * Verify OTP code for newly registered user.
 *
 * When the user enters the 6-digit OTP from their email,
 * this endpoint:
 * 1. Verifies the OTP code against the user's record
 * 2. Sets emailVerified = now() on success
 * 3. Invalidates the OTP token after use (one-time)
 * 4. Returns success - user can now login
 *
 * Request body:
 * { email: string, otp: string }
 *
 * Response:
 * { success: true, message: string }
 * { success: false, message: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-server";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { verifyOtpCode } from "@/services/repositories/otpRepository";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const raw = body as { email?: string; otp?: string };

    const email = (raw.email ?? "").trim().toLowerCase();
    const otp = (raw.otp ?? "").trim();

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }

    if (!otp) {
      return NextResponse.json(
        { success: false, message: "Verification code is required" },
        { status: 400 }
      );
    }

    // Validate OTP code format (6-digit numeric)
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { success: false, message: "Invalid verification code format" },
        { status: 400 }
      );
    }

    // Look up user by email
    const userResult = await db
      .select({
        id: users.id,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (userResult.length === 0) {
      // Generic error - don't reveal that user doesn't exist
      return NextResponse.json(
        { success: false, message: "Invalid verification code" },
        { status: 400 }
      );
    }

    const user = userResult[0];

    // Already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { success: true, message: "Email already verified" },
        { status: 200 }
      );
    }

    // Verify OTP code
    const verifyResult = await verifyOtpCode(user.id, otp, "email");
    if (!verifyResult.success) {
      return NextResponse.json(
        { success: false, message: verifyResult.error || "Invalid verification code" },
        { status: 400 }
      );
    }

    // Mark email as verified (ISO string for timestamp column)
    const now = new Date().toISOString();
    await db
      .update(users)
      .set({
        emailVerified: now,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // OTP was consumed during verifyOtpCode
    return NextResponse.json(
      { success: true, message: "Email verified successfully. You can now log in." },
      { status: 200 }
    );
  } catch (error) {
    console.error("[VERIFY_REGISTRATION_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";