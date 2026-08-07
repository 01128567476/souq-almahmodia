/**
 * POST /api/auth/resend-verification
 *
 * Resend OTP verification code to a user.
 * Implements rate limiting to prevent abuse.
 *
 * Request body:
 * - email: string (user's email address)
 *
 * Response:
 * - success: boolean
 * - message: string
 *
 * Security:
 * - Rate limited to 3 requests per 15 minutes per email
 * - Generic success message to prevent user enumeration
 * - Generates new OTP code (one-time use)
 */

import { NextRequest, NextResponse } from "next/server";
import { createOtpToken } from "@/services/repositories/otpRepository";
import { userRepository } from "@/services/repositories/userRepository";
import { getEmailService } from "@/services/email/emailService";

/** Rate limiting: max 3 resends per window */
const MAX_RESENDS = 3;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/** Simple in-memory rate limiter (extend to Redis for production). */
const resendStore = new Map<string, Date[]>();

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const timestamps = resendStore.get(identifier) ?? [];

  // Remove old timestamps outside the window
  const recent = timestamps.filter(t => now - t.getTime() < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= MAX_RESENDS) {
    resendStore.set(identifier, recent);
    return true;
  }

  recent.push(new Date());
  resendStore.set(identifier, recent);
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body as { email?: string };

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit by email
    if (isRateLimited(normalizedEmail)) {
      return NextResponse.json(
        { success: false, message: "Too many requests. Please wait 15 minutes." },
        { status: 429 }
      );
    }

    // Find user by email
    const user = await userRepository.getByEmail(normalizedEmail);

    // Always return success to prevent user enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "If the email exists in our system, a verification code has been sent.",
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: "Email is already verified.",
      });
    }

    // Generate new OTP code
    const otpResult = await createOtpToken(user.id, normalizedEmail, "verify");
    if (!otpResult.success || !otpResult.code) {
      return NextResponse.json(
        { success: false, message: "Failed to generate verification code." },
        { status: 500 }
      );
    }

    // Send OTP via email
    try {
      const emailService = getEmailService();
      await emailService.sendOtpEmail(
        user.email,
        otpResult.code,
        "verify",
        "en"
      );
    } catch (emailError) {
      console.error("[RESEND_VERIFICATION] Email send failed:", emailError);
      // Continue — still return success to prevent enumeration
    }

    return NextResponse.json({
      success: true,
      message: "If the email exists in our system, a verification code has been sent.",
    });
  } catch (error) {
    console.error("[RESEND_VERIFICATION_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to send verification code." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";