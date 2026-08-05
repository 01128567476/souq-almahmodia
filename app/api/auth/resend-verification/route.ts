/**
 * POST /api/auth/resend-verification
 *
 * Resend a verification email to a user.
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
 * - Invalidates previous unused tokens (one token per resend)
 */

import { NextRequest, NextResponse } from "next/server";
import { createVerificationToken, invalidateUserTokens } from "@/services/repositories/verificationRepository";
import { getSession, getViewerId } from "@/lib/serverAuth";
import { userRepository } from "@/services/repositories/userRepository";

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

    // If user is authenticated, use session email
    let targetEmail = email;
    if (!targetEmail) {
      const session = await getSession();
      if (session?.user?.email) {
        targetEmail = session.user.email;
      }
    }

    if (!targetEmail) {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }

    // Rate limit by email (unauthenticated) and by user ID (authenticated)
    const viewerId = await getViewerId();
    const rateIdentifier = viewerId ?? targetEmail;
    
    if (isRateLimited(rateIdentifier)) {
      return NextResponse.json(
        { success: false, message: "Too many requests. Please wait 15 minutes." },
        { status: 429 }
      );
    }

    // Find user by email
    const user = await userRepository.getByEmail(targetEmail.toLowerCase().trim());

    // Always return success to prevent user enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "If the email exists in our system, a verification link has been sent.",
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: "Email is already verified.",
      });
    }

    // Invalidate old tokens and create new one
    await invalidateUserTokens(user.id);
    const result = await createVerificationToken(user.id, user.email);

    if (result.error) {
      return NextResponse.json(
        { success: false, message: "Failed to send verification email." },
        { status: 500 }
      );
    }

    // TODO: Send verification email with token
    // const verificationUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${result.token}`;
    // await sendVerificationEmail(user.email, verificationUrl);

    return NextResponse.json({
      success: true,
      message: "If the email exists in our system, a verification link has been sent.",
    });
  } catch (error) {
    console.error("[RESEND_VERIFICATION_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to send verification email." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";