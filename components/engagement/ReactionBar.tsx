"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { REACTIONS, REACTION_BY_TYPE } from "@/constants/reactions";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/utils/cn";
import type { ReactionSummary, ReactionType } from "@/types";

/** Map reaction type to emoji for display. */
const REACTION_EMOJI: Record<ReactionType, string> = {
  like: "\uD83D\uDC4D", // 👍
  love: "\u2764\uFE0F", // ❤️
  funny: "\uD83D\uDE02", // 😂
  wow: "\uD83D\uDE2E", // 😮
  sad: "\uD83D\uDE22", // 😢
};

/**
 * Facebook-style reaction control for one advertisement.
 *
 * - Desktop: hovering the trigger opens the emoji picker.
 * - Mobile: tapping the trigger opens it (no hover, no long-press).
 * - Selecting a reaction sets/changes it; selecting the active one removes it.
 *
 * This is a controlled component: reaction state (`summary`, `onReact`,
 * `pending`) is owned by the parent via `useReactions` and shared with any
 * sibling that shows the reaction count, so the bar and the count can never
 * drift apart. The running total is intentionally not rendered here — the
 * surrounding UI already shows it.
 */
export function ReactionBar({
  adId,
  summary,
  onReact,
  pending = false,
  isAuthenticated,
}: {
  adId: string;
  summary: ReactionSummary | null;
  onReact: (type: ReactionType) => void;
  pending?: boolean;
  isAuthenticated: boolean;
}) {
  const t = useTranslations("reactions");
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click / Escape (covers mobile tap-away).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const openNow = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  // Small delay so moving between trigger and popover doesn't flicker closed.
  const closeSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };

  const requireAuth = (): boolean => {
    if (isAuthenticated) return true;
    alert(t("loginRequired"));
    router.push(`${ROUTES.login}?next=${encodeURIComponent(`/product/${adId}`)}`);
    return false;
  };

  const pick = (type: ReactionType, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    if (!requireAuth()) return;
    onReact(type); // toggles: re-selecting the active reaction removes it.
  };

  // Clicking the trigger: on a reacted item toggles it off; otherwise opens picker.
  const onTriggerClick = () => {
    if (!requireAuth()) return;
    // If user has an existing reaction, remove it; otherwise open picker
    const viewerReaction = summary?.viewerReaction;
    if (viewerReaction) {
      onReact(viewerReaction);
    } else {
      setOpen((v) => !v);
    }
  };

  // Determine which reaction is currently active
  const active = summary?.viewerReaction ?? null;
  const activeConfig = active ? REACTION_BY_TYPE[active] : null;
  const activeEmoji = active ? REACTION_EMOJI[active] : "\uD83D\uDC4D";

  return (
    <div className="flex flex-wrap items-center gap-md">
      <div
        ref={containerRef}
        className={cn(
          "relative",
          !isAuthenticated && "cursor-not-allowed opacity-70",
        )}
        onMouseEnter={isAuthenticated ? openNow : undefined}
        onMouseLeave={isAuthenticated ? closeSoon : undefined}
      >
        {/* Picker popover */}
        <div
          role="menu"
          aria-label={t("pick")}
          className={cn(
            "absolute bottom-full start-0 mb-2 flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-lowest p-1 shadow-xl transition-all duration-150 origin-bottom",
            open
              ? "pointer-events-auto scale-100 opacity-100"
              : "pointer-events-none scale-90 opacity-0",
          )}
        >
          {REACTIONS.map((r, i) => (
            <button
              key={r.type}
              type="button"
              role="menuitemradio"
              aria-checked={active === r.type}
              aria-label={t(r.labelKey)}
              title={!isAuthenticated ? t("loginRequired") : t(r.labelKey)}
              onClick={(e) => pick(r.type, e)}
              disabled={!isAuthenticated || pending}
              className={cn(
                "grid h-10 w-10 place-items-center rounded-full text-2xl transition-transform duration-150 hover:-translate-y-1 hover:scale-125 motion-reduce:transform-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-none",
                active === r.type && "bg-primary-fixed",
              )}
              style={{ transitionDelay: open ? `${i * 25}ms` : "0ms" }}
            >
              <span className="leading-none">{r.emoji}</span>
            </button>
          ))}
        </div>

        {/* Trigger button */}
        <button
          type="button"
          onClick={onTriggerClick}
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={pending || !isAuthenticated}
          title={!isAuthenticated ? t("loginRequired") : undefined}
          className={cn(
            "flex items-center gap-xs rounded-full border px-md py-sm font-label-md text-label-md transition-all disabled:cursor-not-allowed disabled:opacity-60",
            activeConfig
              ? "border-primary/40 bg-primary-fixed"
              : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low active:scale-95",
          )}
        >
          {activeConfig ? (
            // Show selected reaction emoji + translated label
            <>
              <span className="text-base leading-none">{activeEmoji}</span>
              <span className={activeConfig.color}>{t(activeConfig.labelKey)}</span>
            </>
          ) : (
            // Default state: no reaction selected
            <>
              <Icon name="thumb_up" size={18} className="text-on-surface-variant" />
              <span className="text-on-surface-variant">{t("react")}</span>
            </>
          )}
        </button>
      </div>

      {/* Unauthenticated hint */}
      {!isAuthenticated && (
        <p className="text-body-sm text-on-surface-variant italic">
          {t("loginToReact")}
        </p>
      )}
    </div>
  );
}