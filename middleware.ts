/**
 * Next.js middleware for internationalization, route protection, and security headers.
 *
 * Runtime: nodejs (required for pg connection when auth is imported)
 */

import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing, locales } from "@/i18n/routing";
import { requiredRoleFor } from "@/constants/routes";
import { hasAtLeast } from "@/constants/roles";
import { getViewerRole } from "@/lib/serverAuth";
import type { Role } from "@/types";

const intlMiddleware = createIntlMiddleware(routing);

const localePattern = new RegExp(`^/(${locales.join("|")})`);

/**
 * Security headers applied to every response.
 * CSP configured for: Cloudinary images, blob previews, Google OAuth.
 */
const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Content-Security-Policy":
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://ajax.googleapis.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src 'self' data: blob: https://res.cloudinary.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "connect-src 'self' https://accounts.google.com https://ajax.googleapis.com https://api.cloudinary.com https://res.cloudinary.com; " +
    "frame-src https://accounts.google.com; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "frame-ancestors 'none'",
  "Cache-Control": "no-store, max-age=0",
};

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Strip the locale prefix to match against locale-agnostic route rules.
  const pathWithoutLocale = pathname.replace(localePattern, "") || "/";
  const locale = pathname.match(localePattern)?.[1] ?? routing.defaultLocale;

  // Get the ACTUAL user role from the session (Auth.js validates the JWT)
  const role: Role = await getViewerRole();

  // Route protection via role-based access control.
  const required = requiredRoleFor(pathWithoutLocale);

  if (required && !hasAtLeast(role, required)) {
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