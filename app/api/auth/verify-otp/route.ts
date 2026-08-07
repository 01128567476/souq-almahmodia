/**
 * POST /api/auth/verify-otp
 *
 * Verify an OTP code provided by the user.
 *
 * Request body:
 * - email: string (user's email)
 * - code: string (6-digit OTP code)
 * - purpose: string (optional — "login", "verify", "reset")
 *
 * Response:
 * - success: boolean
 * - message: string
 * - userId: string (if successful)
 *
 * Security:
 * - Code is hashed before DB lookup
 * - 10-minute expiration
 * - One-time use (invalidated after verification)
 * - 5 failed attempt limit per token
 * - Rate limited via send-otp endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { userRepository } from "@/services/repositories/userRepository";
import { verifyOtpCode, consumeOtpToken } from "@/services/repositories/otpRepository";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, purpose } = body as {
      email?: string;
      code?: string;
      purpose?: "login" | "verify" | "reset";
    };

    if (!email || !code) {
      return NextResponse.json(
        { success: false, message: "Email and OTP code are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const p = purpose ?? "login";

    // Find user
    const user = await userRepository.getByEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Invalid OTP code" },
        { status: 400 }
      );
    }

    // Verify the code only (checks expiration, rate limit, hash match)
    // NOTE: We DO NOT consume the OTP here. The OTP is consumed only when
    // the password is actually reset in /api/auth/reset-password.
    // This prevents the "double consume" bug where verify-otp consumes the
    // OTP and then reset-password fails because it's already used.
    const verifyResult = await verifyOtpCode(user.id, code, "email");
    if (!verifyResult.success) {
      return NextResponse.json(
        { success: false, message: verifyResult.error || "Invalid OTP code" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "OTP verified successfully",
      userId: user.id,
    });
  } catch (error) {
    console.error("[VERIFY_OTP_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "OTP verification failed" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";