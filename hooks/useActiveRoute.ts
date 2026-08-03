"use client";

import { usePathname } from "@/i18n/routing";

/**
 * Returns a matcher for highlighting active nav links.
 * Uses the locale-agnostic pathname from next-intl navigation.
 */
export function useActiveRoute() {
  const pathname = usePathname();

  return {
    pathname,
    isActive: (href: string, exact = false) =>
      exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`),
  };
}
