/**
 * Server-side authentication — thin wrapper around Auth.js (NextAuth v5).
 *
 * This module is the SINGLE source of truth for server-side session validation.
 * All session reading, JWT parsing, and user identification goes through Auth.js.
 *
 * Design:
 * - getSession() — thin wrapper around Auth.js getSession()
 * - getViewerId() — returns user ID or null
 * - getViewerRole() — returns role or "guest"
 * - isAdmin() — convenience check
 * - getCurrentUser() — returns user object or null
 *
 * NO custom JWT code. NO cookie parsing. NO signature verification.
 * Auth.js handles all of that internally.
 */

import { auth } from "@/auth";
import type { Role } from "@/types";

/**
 * Get the current session from the request (uses Auth.js JWT strategy).
 * Returns null if unauthenticated.
 */
export async function getSession() {
  const session = await auth();
  return session ?? null;
}

/**
 *
 Get the current user's ID. * Returns null if unauthenticated.
 */
export async function getViewerId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}

/**
 * Get the current user's role.
 * Returns "guest" if unauthenticated.
 */
export async function getViewerRole(): Promise<Role> {
  const session = await getSession();
  return session?.user?.role ?? "guest";
}

/**
 * Check if the current viewer is an admin.
 */
export async function isAdmin(): Promise<boolean> {
  return (await getViewerRole()) === "admin";
}

/**
 * Get the full current user object.
 * Returns null if unauthenticated.
 */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.user) return null;

  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role ?? "guest",
    avatar: session.user.image ?? undefined,
  };
}