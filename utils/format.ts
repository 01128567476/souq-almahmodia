import type { Locale } from "@/i18n/routing";

/** Format a price with its currency, localized for the active locale. */
export function formatPrice(amount: number, currency: string, locale: Locale): string {
  const localeTag = locale === "ar" ? "ar-SA" : "en-US";
  const formatted = new Intl.NumberFormat(localeTag, {
    maximumFractionDigits: 0,
  }).format(amount);
  // Replace SAR with locale-appropriate currency display
  const displayCurrency = currency === "SAR" ? (locale === "ar" ? "\u062c\u0646\u064a\u0647" : "EGP") : currency;
  return `${displayCurrency} ${formatted}`;
}

/** Strip a phone number down to digits for use in `wa.me` / `tel:` links. */
export function phoneDigits(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

/** Format an ISO date string for the active locale. */
export function formatDate(iso: string, locale: Locale): string {
  const localeTag = locale === "ar" ? "ar-EG" : "en-US";
  return new Intl.DateTimeFormat(localeTag, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

/**
 * Locale-aware integer for exact engagement totals, e.g. 1248 -> "1,248".
 * Locale-agnostic call site: components pass the active locale via `useLocale`,
 * but headline totals that only need grouping can omit it (defaults to en-US).
 */
export function formatCount(value: number, locale: Locale = "en"): string {
  const localeTag = locale === "ar" ? "ar-EG" : "en-US";
  return new Intl.NumberFormat(localeTag, { maximumFractionDigits: 0 }).format(value);
}

/** Compact number for engagement counts, e.g. 1248 -> "1.2K" / "١٫٢ ألف". */
export function formatCompact(value: number, locale: Locale): string {
  const localeTag = locale === "ar" ? "ar-EG" : "en-US";
  return new Intl.NumberFormat(localeTag, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Relative time from an ISO timestamp to now, localized, e.g. "3h ago".
 * Uses Intl.RelativeTimeFormat so both locales read naturally.
 */
export function formatRelativeTime(iso: string, locale: Locale): string {
  const localeTag = locale === "ar" ? "ar-EG" : "en-US";
  const rtf = new Intl.RelativeTimeFormat(localeTag, { numeric: "auto" });
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const abs = Math.abs(diffSec);

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];

  for (const [unit, secs] of units) {
    if (abs >= secs || unit === "second") {
      return rtf.format(Math.round(diffSec / secs), unit);
    }
  }
  return rtf.format(0, "second");
}
