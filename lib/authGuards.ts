/**
 * Centralized authentication & authorization guards.
 *
 * These utilities replace inline auth checks across API routes.
 * All identity MUST be derived from session — never from client query params.
 *
 * Usage:
 *   const user = await requireAuth(req);
 *   if (!user) return Res.json({ error: "Unauthorized" }, { status: 401 });
 *
 *   const admin = await requireAdmin(req);
 *   if (!admin) return Res.json({ error: "Forbidden" }, { status: 403 });
 */

import { getCurrentUser as _getCurrentUser } from "@/lib/serverAuth";
import type { Role } from "@/types";
import { NextResponse } from "next/server";

/* -------------------------------------------------------------------------- */
/* Types                                                                        */
/* -------------------------------------------------------------------------- */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  image?: string;
  updatedAt?: string;
}

/* -------------------------------------------------------------------------- */
/* Guards                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Require authentication.
 * Returns user object from session, or NextResponse with 401.
 */
export async function requireAuth(): Promise<NextResponse<unknown> | AuthUser> {
  try {
    const user = await _getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    return {
      id: user.id,
      email: user.email ?? "",
      name: user.name ?? "",
      role: (user.role as Role) ?? "user",
      image: user.avatar ?? undefined,
    };
  } catch {
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 500 },
    );
  }
}

/**
 * Require admin role.
 * Returns user object if role is "admin", or NextResponse with 403.
 */
export async function requireAdmin(): Promise<NextResponse<unknown> | AuthUser> {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  if (user.role !== "admin") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );
  }

  return user;
}

/**
 * Require cron secret.
 * Validates the X-Cron-Secret header matches the environment CRON_SECRET.
 */
export function requireCronSecret(request: Request): NextResponse<unknown> | true {
  const cronSecret = request.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    // Fail open in development, fail closed in production
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Cron endpoint misconfigured" },
        { status: 500 },
      );
    }
    return true;
  }

  // Use timing-safe comparison to prevent timing attacks
  if (!cronSecret || !timingSafeEqual(cronSecret, expectedSecret)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  return true;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Timing-safe string comparison.
 * Prevents timing attacks on secret comparison.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);

  for (let i = 0; i < aBytes.length; i++) {
    result |= aBytes[i] ^ bBytes[i];
  }

  return result === 0;
}