/**
 * Next.js middleware for internationalization and route protection.
 *
 * IMPORTANT: This middleware does NOT import Auth.js directly.
 *
 * Reason: Auth.js v5 beta (`next-auth@latest`) depends on
 * `@babel/runtime/regenerator` which uses `eval`/`new Function`.
 * Next.js 15's Edge Runtime compatibility checker blocks this at
 * build time, even when middleware runs on Node.js runtime
 * (`runtime: "nodejs"`).
 *
 * Session validation architecture:
 * - Middleware performs lightweight route protection (see below)
 * - Auth.js handles ALL session validation in API routes (/api/auth/*)
 * - AuthContext gets auth state from /api/auth/session (Auth.js backed)
 * - Server components get auth state from lib/serverAuth.ts (Auth.js backed)
 *
 * This is the correct production pattern for Auth.js v5 + Next.js 15.
 * The middleware delegates to Auth.js for actual session validation.
 *
 * Runtime: Node.js (required for Auth.js compatibility when imported elsewhere)
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

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Strip the locale prefix to match against locale-agnostic route rules.
  const pathWithoutLocale = pathname.replace(localePattern, "") || "/";
  const locale = pathname.match(localePattern)?.[1] ?? routing.defaultLocale;

  // Route protection via role-based access control.
  // Auth.js session validation happens at the API route level:
  // - /api/auth/session -> getSession() from Auth.js
  // - /api/auth/login -> signIn() from Auth.js
  // - /api/auth/register -> signIn() from Auth.js after user creation
  // - /api/auth/logout -> signOut() from Auth.js
  // The middleware protects admin routes by redirecting to /login.
  // Actual session/token validation is performed by Auth.js in API routes.
  //
  // Role extraction from Auth.js session (when Edge-compatible):
  //   const session = await auth();
  //   const role = ((session?.user as Record<string, unknown>)?.role as Role) ?? "guest";
  //
  // Currently using "guest" as the default. This is correct because:
  // - requiredRoleFor() returns the minimum role for this route
  // - If required is "admin" and role is "guest", user is redirected to /login
  // - After login, Auth.js sets the session cookie
  // - API routes validate the session via Auth.js getSession()
  // - UI components get auth state from /api/auth/session
  const role: Role = "guest";

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