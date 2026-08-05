/**
 * POST /api/auth/verify-email
 *
 * Verify a user's email address using a token from a verification link.
 *
 * Request body:
 * - token: string (from email link)
 *
 * Response:
 * - success: boolean
 * - message: string
 * - error: string (if failed)
 *
 * Security:
 * - Token is hashed before DB lookup (prevents plaintext exposure)
 * - 24-hour expiration
 * - One-time use (invalidated after verification)
 * - Replay attack prevention (usedAt checked)
 */

import { NextRequest, NextResponse } from "next/server";
import { consumeVerificationToken } from "@/services/repositories/verificationRepository";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body as { token?: string };

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Token is required" },
        { status: 400 }
      );
    }

    const result = await consumeVerificationToken(token);

    if (!result.success) {
      // Use generic messages to prevent user enumeration
      const errorMap: Record<string, string> = {
        "Invalid verification token": "Invalid verification link",
        "Token has already been used": "Link has already been used",
        "Token has expired": "Link has expired",
        "Token verification failed": "Verification failed",
      };
      return NextResponse.json(
        { success: false, message: errorMap[result.error!] || result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("[VERIFY_EMAIL_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Verification failed" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";