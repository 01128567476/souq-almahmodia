"use client";

import { useLocale } from "next-intl";
import { cn } from "@/utils/cn";
import type { Locale } from "@/i18n/routing";

interface PinBadgeProps {
  pinned: boolean;
  /** Size variant: "sm" for cards, "md" for details pages. */
  size?: "sm" | "md";
}

export function PinBadge({ pinned, size = "sm" }: PinBadgeProps) {
  const locale = useLocale() as Locale;
  const text: string = locale === "ar" ? "مثبت" : "Pinned";

  if (!pinned) return null;

  const sizeClasses =
    size === "md"
      ? "text-body-sm font-body-sm gap-1 px-3 py-1"
      : "text-label-xs font-label-xs gap-0.5 px-2 py-0.5";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-label-md font-bold pointer-events-none shrink-0",
        "bg-primary-fixed text-on-primary-fixed",
        sizeClasses,
      )}
    >
      <span className="text-sm leading-none" aria-hidden="true">
        📌
      </span>
      <span className="whitespace-nowrap">{text}</span>
    </span>
  );
}