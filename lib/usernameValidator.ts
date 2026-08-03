/**
 * Username validation, availability checking, and suggestion generation.
 *
 * All rules are centralized here so they can be reused by API routes,
 * client forms, and the repository layer without duplication.
 */

/* ======================================================================== */
/* Constants                                                                */
/* ======================================================================== */

/** Minimum username length (inclusive). */
export const USERNAME_MIN_LENGTH = 3;

/** Maximum username length (inclusive). */
export const USERNAME_MAX_LENGTH = 30;

/** Allowed character regex — lowercase alphanumeric, underscore, hyphen, dot. */
const USERNAME_REGEX = /^[a-z0-9._-]+$/;

/**
 * Reserved usernames that must never be claimed.
 * These are used as top-level routes or system identifiers.
 */
const RESERVED_USERNAMES = new Set([
  // Top-level routes
  "api",
  "app",
  "auth",
  "about",
  "account",
  "admin",
  "dashboard",
  "search",
  "category",
  "privacy",
  "terms",
  "login",
  "register",
  "logout",
  "profile",
  "settings",
  "support",
  "help",
  "contact",
  "feedback",
  "report",
  "notifications",
  "favorites",
  "ads",
  "users",
  "moderate",
  "analytics",
  "fonts",
  "_next",
  "vercel",
  "static",
  "media",
  "images",
  "assets",
  "css",
  "js",
  "favicon",
  "robots",
  "sitemap",
  "manifest",
  // System words
  "system",
  "root",
  "moderator",
  "staff",
  "souqna",
  "souq",
  "mahmoudia",
  "marketing",
  "promo",
  "info",
  "hello",
  "nobody",
  "anonymous",
  "bot",
  "council",
  "official",
]);

/* ======================================================================== */
/* Validation                                                               */
/* ======================================================================== */

/**
 * Validate a username against all rules.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateUsername(raw: string): string | null {
  // Trim whitespace
  const value = raw.trim().toLowerCase();

  // Empty after trim
  if (!value) return "username.empty";

  // Length check
  if (value.length < USERNAME_MIN_LENGTH) return `username.minLength`;
  if (value.length > USERNAME_MAX_LENGTH) return `username.maxLength`;

  // Character check — no spaces, only a-z, 0-9, _, -, .
  if (!USERNAME_REGEX.test(value)) return "username.invalidChars";

  // Reserved check
  if (RESERVED_USERNAMES.has(value)) return "username.reserved";

  return null; // valid
}

/* ======================================================================== */
/* Availability                                                             */
/* ======================================================================== */

/**
 * Check if a username is available against a set of existing usernames.
 *
 * @param username  — the requested username (should already be trimmed + lowercased)
 * @param existing  — set of already-taken lowercase usernames
 * @returns null if available, or an error key if taken
 */
export function checkUsernameAvailability(
  username: string,
  existing: Set<string>,
): "taken" | null {
  const normalized = username.trim().toLowerCase();
  if (existing.has(normalized)) {
    return "taken";
  }
  return null;
}

/* ======================================================================== */
/* Suggestions                                                              */
/* ======================================================================== */

/**
 * Generate username suggestions when the requested one is taken.
 */
export function generateUsernameSuggestions(
  requested: string,
  existing: Set<string>,
  count: number = 4,
): string[] {
  const base = requested.trim().toLowerCase();
  const suggestions: string[] = [];
  const suffixes = ["4", "22", "123", "_1", "-2026", "_2024", "_7", "-1", "_a", "_0"];

  // Try base + numeric suffix
  for (const suffix of suffixes) {
    if (suggestions.length >= count) break;
    const candidate = `${base}${suffix}`;
    if (!existing.has(candidate) && !validateUsername(candidate) && !isReserved(candidate)) {
      suggestions.push(candidate);
    }
  }

  // Second pass: random short suffixes
  if (suggestions.length < count) {
    const randomChars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let attempt = 0;
    while (suggestions.length < count && attempt < 50) {
      const randomSuffix = `${randomChars[Math.random() * 36 | 0]}${randomChars[Math.random() * 36 | 0]}`;
      const candidate = `${base}${randomSuffix}`;
      if (!existing.has(candidate) && !validateUsername(candidate) && !isReserved(candidate)) {
        suggestions.push(candidate);
      }
      attempt++;
    }
  }

  // Final fallback: counter-based
  if (suggestions.length < count) {
    let i = suggestions.length + 100;
    while (suggestions.length < count) {
      const candidate = `${base}${i}`;
      if (!existing.has(candidate) && !validateUsername(candidate) && !isReserved(candidate)) {
        suggestions.push(candidate);
      }
      i++;
    }
  }

  return suggestions.slice(0, count);
}

/** Quick check if a username is in the reserved set. */
function isReserved(name: string): boolean {
  return RESERVED_USERNAMES.has(name);
}

/* ======================================================================== */
/* Formatting                                                               */
/* ======================================================================== */

/**
 * Normalize a username for storage: trim, lowercase, validate format.
 * Returns the normalized string or null if the format is invalid.
 */
export function normalizeUsernameInput(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!USERNAME_REGEX.test(value)) return null;
  return value;
}

/* ======================================================================== */
/* Cooldown                                                                 */
/* ======================================================================== */

/** Username change cooldown in milliseconds (10 days). */
export const USERNAME_CHANGE_COOLDOWN_MS = 10 * 24 * 60 * 60 * 1000;

/**
 * Calculate remaining cooldown time.
 */
export function getCooldownRemaining(lastChangedAt: string | null): {
  remainingMs: number;
  daysRemaining: number;
  canChange: boolean;
} {
  if (!lastChangedAt) {
    return { remainingMs: 0, daysRemaining: 0, canChange: true };
  }

  const lastChange = new Date(lastChangedAt).getTime();
  const elapsed = Date.now() - lastChange;
  const remaining = USERNAME_CHANGE_COOLDOWN_MS - elapsed;

  if (remaining <= 0) {
    return { remainingMs: 0, daysRemaining: 0, canChange: true };
  }

  const daysRemaining = Math.ceil(remaining / (24 * 60 * 60 * 1000));
  return { remainingMs: remaining, daysRemaining, canChange: false };
}