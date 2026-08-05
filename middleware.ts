/**
 * Next.js middleware for internationalization and route protection.
 *
 * IMPORTANT: This middleware does NOT import Auth.js directly.
 *
 * Reason: Auth.js v5 depends on `pg` and `bcryptjs` which use Node.js
 * built-in modules (crypto, process). These are not available in any
 * Next.js runtime that webpack bundles for middleware.
 *
 * Session validation architecture:
 * - Middleware performs lightweight route protection by checking
 *   for the presence of the session cookie (soft auth check).
 * - Auth.js handles ALL session validation in API routes (/api/auth/*)
 * - API routes decode and verify the JWT using Auth.js
 * - AuthContext gets auth state from /api/auth/session (Auth.js backed)
 * - Server components get auth state from lib/serverAuth.ts (Auth.js backed)
 *
 * This is the correct production pattern for Auth.js v5 +
 Next.js 15.
 * * Runtime: nodejs (required for pg connection when auth is imported)
 */

import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing, locales } from "@/i18n/routing";
import { requiredRoleFor } from "@/constants/routes";
import type { Role } from "@/types";

const intlMiddleware = createIntlMiddleware(routing);

const localePattern = new RegExp(`^/(${locales.join("|")})`);

/**
 * Security headers applied to every response.
 */
const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://accounts.google.com https://ajax.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://accounts.google.com https://ajax.googleapis.com",
    "frame-src 'self' https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
  "Cache-Control": "no-store, max-age=0",
};

/**
 * Soft authentication check — does NOT validate the JWT.
 *
 * This function only checks if a session cookie EXISTS in the request.
 * It does NOT decode, verify, or trust the cookie content.
 *
 * Actual JWT validation happens at the API route level via Auth.js.
 *
 * Returns "user" if any session cookie is present (assumes user role for protected routes),
 * "guest" if no session cookie is present.
 *
 * This is a lightweight check that avoids bundling pg/crypto in middleware.
 */
function getSoftRole(request: NextRequest): Role {
  // Check for both development and production cookie names
  const hasCookie =
    request.cookies.get("next-auth.session-token") !== undefined ||
    request.cookies.get("__Secure-next-auth.session-token") !== undefined;

  return hasCookie ? "user" : "guest";
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Strip the locale prefix to match against locale-agnostic route rules.
  const pathWithoutLocale = pathname.replace(localePattern, "") || "/";
  const locale = pathname.match(localePattern)?.[1] ?? routing.defaultLocale;

  // Soft role check — cookie present = user, missing = guest.
  // Real JWT validation is performed by Auth.js in API routes.
  const role: Role = getSoftRole(request);

  // Route protection via role-based access control.
  const required = requiredRoleFor(pathWithoutLocale);

  if (required && role !== required) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = "";
    url.searchParams.set("next", `${pathWithoutLocale}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  const response = intlMiddleware(request);

  // Apply security headers to every response
  for (const [header, value] of Object.entries(securityHeaders)) {
    response.headers.set(header, value);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
  runtime: "nodejs",
};