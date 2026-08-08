"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { EngagementStats } from "@/types";

interface UseEngagementStatsBatchResult {
  stats: Record<string, EngagementStats>;
  loading: boolean;
  /** Merge a partial update for one ad into local state (no re-fetch). */
  patchStats: (adId: string, patch: Partial<EngagementStats>) => void;
}

/**
 * Load engagement stats for a batch of advertisements at once.
 * Used by card grids and the My Ads page so each card doesn't fetch on its own.
 *
 * `patchStats` lets a card apply an optimistic count change (e.g. a favorite
 * toggle) to the shared stats without triggering another network round-trip,
 * keeping the batch the single source of truth for counts.
 */
export function useEngagementStatsBatch(adIds: string[]): UseEngagementStatsBatchResult {
  const { user } = useAuth();
  const viewerId = user?.id ?? null;

  const [stats, setStats] = useState<Record<string, EngagementStats>>({});
  const [loading, setLoading] = useState(true);

  // Stable key so the effect only re-runs when the actual id set changes.
  const key = adIds.join(",");

  useEffect(() => {
    let active = true;
    setLoading(true);
    if (!key) {
      if (active) setStats({});
      setLoading(false);
      return;
    }
    fetch(`/api/ads/stats?ids=${encodeURIComponent(key)}&viewerId=${viewerId ?? ""}`)
      .then((res) => res.json())
      .then((result) => {
        // API returns { stats: { adId: EngagementStats } }
        if (active) setStats(result?.stats ?? {});
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key, viewerId]);

  const patchStats = useCallback((adId: string, patch: Partial<EngagementStats>) => {
    setStats((prev) => {
      const current = prev[adId];
      if (!current) return prev;
      return { ...prev, [adId]: { ...current, ...patch } };
    });
  }, []);

  return { stats, loading, patchStats };
}