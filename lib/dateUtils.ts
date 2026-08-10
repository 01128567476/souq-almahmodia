/**
 * Strict date normalization utilities.
 * Ensures consistent ISO format across the application.
 * Handles Date objects, ISO strings, and invalid values safely.
 */

/**
 * Get current timestamp as ISO string.
 * Use for created_at / updated_at fields.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Normalize date values from database to consistent ISO string format.
 * Returns null for missing/invalid values to preserve data integrity.
 *
 * @param value - Date object, ISO string, or null/undefined
 * @returns ISO string if valid, null otherwise
 */
export function normalizeDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) {
      console.warn("[DATE] Invalid date string:", value);
      return null;
    }
    return parsed.toISOString();
  }

  console.warn("[DATE] Unsupported date type:", value);
  return null;
}

/**
 * Safe date with optional fallback.
 * NEVER fakes data unless explicitly requested.
 *
 * @param value - Date value to normalize
 * @param options - Fallback configuration
 * @returns Normalized ISO string, fallback, or null
 */
export function safeDate(
  value: Date | string | null | undefined,
  options?: { fallback?: "now" | "null" }
): string | null {
  const normalized = normalizeDate(value);

  if (normalized) return normalized;

  if (options?.fallback === "now") return nowIso();

  return null; // NEVER fake data unless explicitly requested
}