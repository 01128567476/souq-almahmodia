/**
 * POST /api/auth/logout
 *
 * Auth.js compatible logout endpoint.
 * Revokes the session in the database and clears the cookie.
 */

import { NextResponse } from "next/server";
import
 { signOut } from "@/auth";import { deleteServerCookie } from "@/lib/cookies";
import { SESSION_COOKIE } from "@/constants/roles";

export async function POST() {
  try {
    // Clear the session cookie
    await deleteServerCookie(SESSION_COOKIE);

    // Sign out via Auth.js
    await signOut({ redirect: false });
  } catch {
    // Ignore errors — we still want to return success
  }

  return NextResponse.json({ success: true });
}

export const dynamic = "force-dynamic";