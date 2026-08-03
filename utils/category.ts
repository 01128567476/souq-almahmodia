import type { Category } from "@/types";
import type { Locale } from "@/i18n/routing";

/**
 * Display name for a category in the active locale.
 *
 * Categories carry bilingual `nameEn`/`nameAr` (set for both seeded and
 * admin-created categories). Falls back to the legacy `name` key if a bilingual
 * value is missing, so the resolver is always safe.
 */
export function resolveCategoryName(category: Category, locale: Locale): string {
  const localized = locale === "ar" ? category.nameAr : category.nameEn;
  return localized ?? category.nameEn ?? category.name;
}
