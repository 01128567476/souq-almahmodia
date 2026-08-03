"use client";

import { useCallback, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthContext";
import type { EngagementStats } from "@/types";

interface UseFavoriteResult {
  /** True while a toggle request is settling. */
  pending: boolean;
  /** Toggle the viewer's favorite for this ad. Redirects guests to login. */
  toggle: () => void;
}

/**
 * Favorite toggle for one advertisement, driven by the shared engagement stats.
 *
 * State is not owned here: the current `favorited` and `count` come from the
 * batch stats (the single source of truth). Toggling optimistically reports the
 * new values through `onChange` so every place that shows the count updates at
 * once, then reconciles with the authoritative API response — no extra
 * fetch on success.
 */
export function useFavorite(
  adId: string,
  favorited: boolean,
  count: number,
  onChange: (patch: Pick<EngagementStats, "favorites" | "viewerHasFavorited">) => void,
): UseFavoriteResult {
  const { user, isAuthenticated } = useAuth();
  const viewerId = user?.id ?? null;
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const toggle = useCallback(() => {
    if (!isAuthenticated || !viewerId) {
      router.push(`${ROUTES.login}?next=${encodeURIComponent(`/product/${adId}`)}`);
      return;
    }

    const next = !favorited;

    // Optimistic: flip immediately so the heart feels instant.
    onChange({
      viewerHasFavorited: next,
      favorites: Math.max(0, count + (next ? 1 : -1)),
    });
    setPending(true);

    const method = next ? "POST" : "DELETE";
    fetch(`/api/ads/${adId}/favorites?userId=${viewerId}`, { method })
      .then((res) => res.json())
      .then((data) => {
        if (data?.stats) {
          onChange({ favorites: data.stats.favorites, viewerHasFavorited: data.stats.viewerHasFavorited });
        }
      })
      .catch(() => {
        // Revert on failure.
        onChange({ viewerHasFavorited: favorited, favorites: count });
      })
      .finally(() => setPending(false));
  }, [adId, favorited, count, isAuthenticated, viewerId, router, onChange]);

  return { pending, toggle };
}