/**
 * POST /api/auth/send-otp
 *
 * Send a one-time password (OTP) to a user's email.
 *
 * Request body:
 * - email: string (user's email address)
 * - purpose: string (optional — "login", "verify", "reset")
 *
 * Response:
 * - success: boolean
 * - message: string
 *
 * Security:
 * - Rate limited to 3 requests per 15 minutes per email
 * - 6-digit numeric code
 * - 10-minute expiration
 * - One-time use
 * - 5 verification attempts max
 * - Generic success message to prevent user enumeration
 */

import { NextRequest, NextResponse } from "next/server";
import { createOtpToken } from "@/services/repositories/otpRepository";
import { userRepository } from "@/services/repositories/userRepository";

/** Rate limiting: max 3 requests per window */
const MAX_REQUESTS = 3;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/** In-memory rate limiter (extend to Redis for production). */
const otpStore = new Map<string, Date[]>();

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const timestamps = otpStore.get(identifier) ?? [];
  const recent = timestamps.filter(t => now - t.getTime() < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    otpStore.set(identifier, recent);
    return true;
  }

  recent.push(new Date());
  otpStore.set(identifier, recent);
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, purpose } = body as {
      email?: string;
      purpose?: "login" | "verify" | "reset";
    };

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const p = purpose ?? "login";

    // Rate limit
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
        message: "If the email exists in our system, an OTP code has been sent.",
      });
    }

    // Create OTP token
    const result = await createOtpToken(user.id, user.email, "email");

    if (!result.success || !result.code) {
      return NextResponse.json(
        { success: false, message: "Failed to send OTP code." },
        { status: 500 }
      );
    }

    // TODO: Send OTP via email
    // await sendOtpEmail(user.email, result.code, p);

    return NextResponse.json({
      success: true,
      message: "If the email exists in our system, an OTP code has been sent.",
    });
  } catch (error) {
    console.error("[SEND_OTP_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to send OTP code." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";