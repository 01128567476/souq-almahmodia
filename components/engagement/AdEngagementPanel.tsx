"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { ReactionBar } from "@/components/engagement/ReactionBar";
import { CommentsSection } from "@/components/engagement/CommentsSection";
import { useReactions } from "@/hooks/useReactions";
import { useFavorite } from "@/hooks/useFavorite";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/utils/cn";
import type { EngagementStats } from "@/types";

/** Default stats fallback — ensures UI never breaks when API fails. */
const DEFAULT_STATS: EngagementStats = {
  adId: "",
  views: 0,
  reactions: 0,
  comments: 0,
  favorites: 0,
  viewerHasFavorited: false,
};

/**
 * Engagement block shown below an advertisement's details: Favorite button,
 * reaction bar, and the full comments thread (with its count).
 * Reaction state is owned via `useReactions`; Favorite state is fetched once
 * and managed optimistically via `useFavorite`.
 */
export function AdEngagementPanel({
  adId,
  advertisement,
}: {
  adId: string;
  /** The owning ad, threaded to comments for delete permission checks. */
  advertisement?: { ownerId?: string } | null;
}) {
  const t = useTranslations("engagement");
  const { isAuthenticated } = useAuth();
  const { summary, react, pending: reactPending } = useReactions(adId);

  // Fetch initial engagement stats to get favorites state
  // Defensive: always initialized with default to never be null
  const [stats, setStats] = useState<EngagementStats>(() => ({ ...DEFAULT_STATS, adId }));

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/ads/${adId}/stats`);
        if (!res.ok) return;
        const data = await res.json();
        // Extract from { stats: EngagementStats }
        const statsData = data?.stats ?? null;
        if (statsData) {
          setStats(statsData);
        }
        // Fallback: if stats is missing, keep current state (already has defaults)
      } catch {
        // Silently fail — stats are optional, defaults already set
      }
    };
    fetchStats();
  }, [adId]);

  // Defensive: ensure stats is never null
  const safeStats = stats || { ...DEFAULT_STATS, adId };

  const favorited = safeStats.viewerHasFavorited ?? false;
  const favoriteCount = safeStats.favorites ?? 0;

  const { toggle: toggleFavorite, pending: favPending } = useFavorite(
    adId,
    favorited,
    favoriteCount,
    (patch) => {
      setStats((prev) => {
        const newStats = prev ? { ...prev, ...patch } : prev;
        return newStats;
      });
    },
  );

  return (
    <div className="mt-2xl border-t border-outline-variant pt-xl">
      {/* Action row: Favorite button + Reaction bar */}
      <div className="flex flex-wrap items-center gap-md mb-md">
        {/* Favorite button — LEFT of reaction */}
        <button
          type="button"
          onClick={toggleFavorite}
          disabled={!isAuthenticated || favPending}
          aria-label={t(favorited ? "removeFavorite" : "addFavorite")}
          title={!isAuthenticated ? t("loginRequired") : t(favorited ? "removeFavorite" : "addFavorite")}
          className={cn(
            "flex items-center gap-xs rounded-full border px-md py-sm font-label-md text-label-md transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
            favorited
              ? "border-error/40 bg-error/10 text-error hover:bg-error/20"
              : !isAuthenticated
                ? "border-outline-variant bg-surface-container-lowest cursor-not-allowed opacity-60"
                : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low",
          )}
        >
          <Icon
            name="favorite"
            size={18}
            className={cn(favorited ? "text-error" : "text-on-surface-variant")}
            style={favorited ? { fontVariationSettings: "'FILL' 1" } : undefined}
          />
          <span>{favoriteCount}</span>
        </button>

        {/* Unauthenticated hint for favorite */}
        {!isAuthenticated && (
          <span className="text-body-sm text-on-surface-variant italic">
            {t("addFavorite")}
          </span>
        )}
      </div>

      {/* Reaction bar */}
      <ReactionBar
        adId={adId}
        summary={summary}
        onReact={react}
        pending={reactPending}
        isAuthenticated={isAuthenticated}
      />
      <CommentsSection adId={adId} advertisement={advertisement} />
    </div>
  );
}