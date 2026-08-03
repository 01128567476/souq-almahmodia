import type { Role } from "@/types";

/** Central route registry. Paths are locale-agnostic; next-intl adds the prefix. */
export const ROUTES = {
  home: "/",
  search: "/",
  category: (slug: string) => `/category/${slug}`,
  product: (id: string) => `/product/${id}`,
  about: "/about",
  privacy: "/privacy",
  terms: "/terms",
  login: "/login",
  register: "/register",
  account: "/account",
  accountProfile: "/account/profile",
  accountAds: "/account/ads",
  accountAdNew: "/account/ads/new",
  accountAdEdit: (id: string) => `/account/ads/${id}/edit`,
  accountFavorites: "/account/favorites",
  accountNotifications: "/account/notifications",
  // Public profile routes
  userProfile: (username: string) => `/u/${username}`,
  usernameSetup: "/username-setup",
  dashboard: "/dashboard",
  ads: "/dashboard/ads",
  adsPending: "/dashboard/ads/pending",
  adsReported: "/dashboard/ads/reported",
  ad: (id: string) => `/dashboard/ads/${id}`,
  notifications: "/dashboard/notifications",
  users: "/dashboard/users",
  user: (id: string) => `/dashboard/users/${id}`,
  categories: "/dashboard/categories",
  analytics: "/dashboard/analytics",
  profile: "/dashboard/profile",
  dashboardSettings: "/dashboard/settings",
} as const;

/**
 * Prefixes that require authentication and the minimum role required.
 * Ordered most-specific first so `requiredRoleFor` matches the tightest rule.
 */
export const PROTECTED_PREFIXES: { prefix: string; role: Role }[] = [
  { prefix: "/dashboard", role: "admin" },
  { prefix: "/account", role: "user" },
];

/**
 * Minimum role needed to open a locale-agnostic path, or `null` if it is public.
 * Shared by the middleware guard and the post-login redirect so they never disagree.
 */
export function requiredRoleFor(pathWithoutLocale: string): Role | null {
  const rule = PROTECTED_PREFIXES.find((r) => pathWithoutLocale.startsWith(r.prefix));
  return rule?.role ?? null;
}

/**
 * Validate a `next` redirect target read from the URL. Only internal, absolute
 * paths are allowed — protocol-relative (`//host`), external URLs, and the login
 * route itself are rejected to prevent open redirects and login redirect loops.
 */
export function sanitizeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw === ROUTES.login || raw.startsWith(`${ROUTES.login}/`)) return null;
  return raw;
}
