"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/routing";
import { locales, localeConfig, type Locale } from "@/i18n/routing";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/utils/cn";

export function LanguageSwitcher({ variant = "light" }: { variant?: "light" | "dark" }) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const switchTo = (next: Locale) => {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-outline-variant",
        variant === "dark" ? "bg-surface-container-low" : "bg-surface-container-lowest",
        isPending && "opacity-60",
      )}
      role="group"
      aria-label="Language"
    >
      <Icon name="translate" size={18} className="text-on-surface-variant mx-1" />
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          aria-pressed={l === locale}
          className={cn(
            "px-3.5 py-2 rounded-md text-label-md font-label-md transition-colors",
            l === locale
              ? "bg-primary text-on-primary"
              : "text-on-surface-variant hover:text-primary",
          )}
        >
          {localeConfig[l].label}
        </button>
      ))}
    </div>
  );
}
