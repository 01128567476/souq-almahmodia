/**
 * POST /api/auth/forgot-password
 *
 * Step 1 of OTP-based password reset flow.
 * Generates and sends a 6-digit OTP code to the user's email.
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
 * - OTP is 6-digit numeric, expires in 5 minutes
 * - OTP is SHA-256 hashed before storage (never plaintext)
 * - Maximum 3 verification attempts per OTP
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-server";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { createOtpToken } from "@/services/repositories/otpRepository";
import { userRepository } from "@/services/repositories/userRepository";
import { getEmailService } from "@/services/email/emailService";

/** Rate limiting: max 3 requests per window */
const MAX_REQUESTS = 3;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/** In-memory rate limiter (extend to Redis for production). */
const forgotStore = new Map<string, Date[]>();

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const timestamps = forgotStore.get(identifier) ?? [];
  const recent = timestamps.filter(t => now - t.getTime() < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    forgotStore.set(identifier, recent);
    return true;
  }

  recent.push(new Date());
  forgotStore.set(identifier, recent);
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

    // Rate limit
    if (isRateLimited(normalizedEmail)) {
      return NextResponse.json(
        { success: false, message: "Too many requests. Please wait 15 minutes." },
        { status: 429 }
      );
    }

    // Find user by email (generic response to prevent enumeration)
    const user = await userRepository.getByEmail(normalizedEmail);

    // Always return success to prevent user enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "If the email exists in our system, an OTP code has been sent.",
      });
    }

    // If user has no password set (Google-only), allow them to create one
    // This is the FIRST password creation flow for Google users
    // Still generate OTP for verification

    // Create OTP token (invalidates any existing unused ones)
    const result = await createOtpToken(user.id, user.email, "email");

    if (!result.success || !result.code) {
      return NextResponse.json(
        { success: false, message: "Failed to send OTP code." },
        { status: 500 }
      );
    }

    // Send OTP via email service
    try {
      const emailService = getEmailService();
      await emailService.sendOtpEmail(user.email, result.code, "reset", "en");
    } catch (emailError) {
      console.error("[FORGOT_PASSWORD] Email send failed:", emailError);
      // Still return success to prevent enumeration
    }

    return NextResponse.json({
      success: true,
      message: "If the email exists in our system, an OTP code has been sent.",
    });
  } catch (error) {
    console.error("[FORGOT_PASSWORD_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to send OTP code." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";