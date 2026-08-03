"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { formatCompact } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { Locale } from "@/i18n/routing";
import type { EngagementStats as Stats } from "@/types";

interface StatItem {
  key: "views" | "reactions" | "comments" | "favorites";
  icon: string;
  labelKey: string;
}

const ITEMS: StatItem[] = [
  { key: "views", icon: "visibility", labelKey: "views" },
  { key: "reactions", icon: "favorite", labelKey: "reactions" },
  { key: "comments", icon: "chat_bubble", labelKey: "comments" },
  { key: "favorites", icon: "bookmark", labelKey: "favorites" },
];

/**
 * Compact engagement counters. Two variants:
 * - "inline" (default): small muted row for public cards.
 * - "detailed": labelled tiles for the My Ads owner view.
 */
export function EngagementStatsRow({
  stats,
  locale,
  variant = "inline",
  loading = false,
  only,
}: {
  stats: Stats | undefined;
  locale: Locale;
  variant?: "inline" | "detailed";
  loading?: boolean;
  /** Restrict which stats to show (e.g. cards omit views). */
  only?: StatItem["key"][];
}) {
  const t = useTranslations("engagement");
  const items = only ? ITEMS.filter((i) => only.includes(i.key)) : ITEMS;

  if (loading || !stats) {
    return (
      <div
        className={cn(
          "flex gap-md",
          variant === "detailed" && "grid grid-cols-2 sm:grid-cols-4 gap-sm",
        )}
        aria-hidden
      >
        {items.map((i) => (
          <div
            key={i.key}
            className={cn(
              "animate-pulse rounded-lg bg-surface-container",
              variant === "detailed" ? "h-16" : "h-5 w-12",
            )}
          />
        ))}
      </div>
    );
  }

  if (variant === "detailed") {
    return (
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-sm">
        {items.map((i) => (
          <div
            key={i.key}
            className="flex flex-col items-center gap-xs rounded-xl border border-outline-variant bg-surface-container-lowest px-sm py-md text-center"
          >
            <Icon name={i.icon} size={20} className="text-primary" />
            <dt className="sr-only">{t(i.labelKey)}</dt>
            <dd className="font-headline-md text-body-lg text-on-surface">
              {formatCompact(stats[i.key], locale)}
            </dd>
            <span className="text-label-md font-label-md text-on-surface-variant">
              {t(i.labelKey)}
            </span>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <ul className="flex flex-wrap items-center gap-md text-on-surface-variant">
      {items.map((i) => (
        <li key={i.key} className="flex items-center gap-xs text-body-sm font-body-sm">
          <Icon name={i.icon} size={16} />
          <span>{formatCompact(stats[i.key], locale)}</span>
        </li>
      ))}
    </ul>
  );
}
