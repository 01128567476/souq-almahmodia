import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ar";

/** Locale metadata used for the language switcher and <html> attributes. */
export const localeConfig: Record<Locale, { label: string; dir: "rtl" | "ltr" }> = {
  ar: { label: "العربية", dir: "rtl" },
  en: { label: "English", dir: "ltr" },
};

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
});

export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
