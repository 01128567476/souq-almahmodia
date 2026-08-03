/**
 * Secure cookie utilities for Auth.js compatibility.
 *
 * This module provides a centralized, production-ready cookie API.
 * All cookies use:
 * - HttpOnly (prevents XSS access)
 * - Secure (HTTPS only — remove in dev for local testing)
 * - SameSite=Lax (CSRF protection)
 * - Path=/ (available site-wide)
 * - Signed (optional, for tamper detection)
 *
 * When Auth.js lands, these names align with its cookie convention.
 */

import { cookies } from "next/headers";
import { SESSION_COOKIE, ROLES } from "@/constants/roles";
import type { Role } from "@/types";

const DEFAULT_ROLE: Role = "user";

/** Cookie defaults for Auth.js compatibility. */
const COOKIE_DEFAULTS = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

/**
 * Read the current mock role from the session cookie (server side).
 */
export async function getServerRole(): Promise<Role> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  return value && (ROLES as string[]).includes(value) ? (value as Role) : DEFAULT_ROLE;
}

/**
 * Set a secure session cookie.
 *
 * @param name - Cookie name
 * @param value - Cookie value
 * @param options - Optional override settings
 */
export async function setServerCookie(
  name: string,
  value: string,
  options?: { maxAge?: number; secure?: boolean },
): Promise<void> {
  const store = await cookies();
  const cookieOptions = {
    ...COOKIE_DEFAULTS,
    ...options,
  };

  // For now, use plain cookies. When Auth.js lands, use signed cookies.
  store.set({
    name,
    value,
    ...cookieOptions,
  });
}

/**
 * Delete a cookie by setting it to empty with expired date.
 */
export async function deleteServerCookie(name: string): Promise<void> {
  const store = await cookies();
  store.set({
    name,
    value: "",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Validate that a role value is legitimate.
 * Prevents role manipulation attacks.
 */
export function isValidRole(value: string): value is Role {
  return (ROLES as string[]).includes(value);
}

/**
 * Sanitize a role value — fall back to safe default.
 */
export function sanitizeRole(value: string | undefined): Role {
  if (value && isValidRole(value)) return value;
  return DEFAULT_ROLE;
}

/**
 * Auth.js compatible session cookie configuration.
 * These names match what Auth.js expects.
 */
export const AUTH_COOKIE_CONFIG = {
  sessionToken: "authjs.session-token",
  csrfToken: "authjs.csrf-token",
  callbackUrl: "authjs.callback-url",
  state: "authjs.state",
  nonce: "authjs.nonce",
} as const;

/**
 * Generate a secure random token (for future Auth.js compatibility).
 * Uses crypto when available (Node.js).
 */
export function generateSecureToken(length: number = 32): string {
  try {
    const mod = globalThis.require?.("crypto") as typeof import("crypto");
    if (mod?.randomBytes) {
      return mod.randomBytes(length).toString("hex");
    }
  } catch {
    // Fallback for environments without crypto
  }
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
