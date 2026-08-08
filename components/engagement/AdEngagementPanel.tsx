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
  const [stats, setStats] = useState<EngagementStats | null>(null);

  useEffect(() => {
    console.log("[AdEngagementPanel] useEffect triggered for adId:", adId);
    const fetchStats = async () => {
      try {
        console.log("[AdEngagementPanel] Fetching stats for adId:", adId);
        const res = await fetch(`/api/ads/stats?ids=${adId}`);
        console.log("[AdEngagementPanel] Stats API response status:", res.status);
        const data = await res.json();
        console.log("[AdEngagementPanel] Stats API response data:", data);
        const adStats = data?.stats?.[adId] ?? null;
        console.log("[AdEngagementPanel] Extracted adStats:", adStats);
        setStats(adStats);
      } catch (err) {
        console.error("[AdEngagementPanel] Failed to fetch stats:", err);
        // Silently fail — stats are optional
      }
    };
    fetchStats();
  }, [adId]);

  const favorited = stats?.viewerHasFavorited ?? false;
  const favoriteCount = stats?.favorites ?? 0;

  console.log("[AdEngagementPanel] Render: stats=", stats, "favorited=", favorited, "favoriteCount=", favoriteCount, "isAuthenticated=", isAuthenticated);

  const { toggle: toggleFavorite, pending: favPending } = useFavorite(
    adId,
    favorited,
    favoriteCount,
    (patch) => {
      console.log("[AdEngagementPanel] useFavorite onChange called with patch:", patch);
      setStats((prev) => {
        const newStats = prev ? { ...prev, ...patch } : prev;
        console.log("[AdEngagementPanel] setStats called, new stats:", newStats);
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
