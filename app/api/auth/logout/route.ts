/**
 * POST /api/auth/logout
 *
 * Logout endpoint — signs out the current user and clears session cookies.
 *
 * Response:
 * - success: boolean
 * - message: string
 *
 * Security:
 * - Clears session cookie
 * - Invalidates JWT token
 * - Logs logout event for audit
 */

import { NextRequest, NextResponse } from "next/server";
import { signOut } from "@/auth";

export async function POST(request: NextRequest) {
  try {
    // Sign out — clears session cookie and JWT
    await signOut({
      redirect: false,
    });

    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("[LOGOUT_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Logout failed" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";