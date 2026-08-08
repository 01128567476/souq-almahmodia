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
import { db } from "@/lib/db-server";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
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
    const p = purpose ?? "verify";

    // Find user
    const userRow = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (userRow.length === 0) {
      return NextResponse.json(
        { success: false, message: "Invalid OTP code" },
        { status: 400 }
      );
    }

    const user = userRow[0];

    // If email is already verified, return success
    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: "Email already verified",
        userId: user.id,
      });
    }

    // Verify the OTP code
    const verifyResult = await verifyOtpCode(user.id, code, "email");
    if (!verifyResult.success) {
      return NextResponse.json(
        { success: false, message: verifyResult.error || "Invalid OTP code" },
        { status: 400 }
      );
    }

    // Mark email as verified
    await db
      .update(users)
      .set({ emailVerified: new Date().toISOString(), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    console.log(`[VERIFY-OTP] Email verified for user ${user.id} (${user.email})`);

    return NextResponse.json({
      success: true,
      message: p === "verify"
        ? "Email verified successfully. You can now sign in."
        : "OTP verified successfully",
      userId: user.id,
      emailVerified: true,
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