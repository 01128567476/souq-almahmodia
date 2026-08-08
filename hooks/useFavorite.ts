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
    console.log("[useFavorite] toggle() called, isAuthenticated:", isAuthenticated, "viewerId:", viewerId, "favorited:", favorited, "count:", count);
    
    if (!isAuthenticated || !viewerId) {
      console.log("[useFavorite] Not authenticated, redirecting to login");
      router.push(`${ROUTES.login}?next=${encodeURIComponent(`/product/${adId}`)}`);
      return;
    }

    const next = !favorited;
    console.log("[useFavorite] Toggling from favorited:", favorited, "to:", next);

    // Optimistic: flip immediately so the heart feels instant.
    const newCount = Math.max(0, count + (next ? 1 : -1));
    console.log("[useFavorite] Optimistic update: favorited=", next, "count=", newCount);
    onChange({
      viewerHasFavorited: next,
      favorites: newCount,
    });
    setPending(true);

    const method = next ? "POST" : "DELETE";
    console.log("[useFavorite] Calling API:", method, "/api/ads/" + adId + "/favorites?userId=" + viewerId);
    
    fetch(`/api/ads/${adId}/favorites?userId=${viewerId}`, { method })
      .then((res) => {
        console.log("[useFavorite] API response status:", res.status);
        return res.json();
      })
      .then((data) => {
        console.log("[useFavorite] API response data:", data);
        if (data?.stats) {
          console.log("[useFavorite] Applying server stats: favorites=", data.stats.favorites, "viewerHasFavorited=", data.stats.viewerHasFavorited);
          onChange({ favorites: data.stats.favorites, viewerHasFavorited: data.stats.viewerHasFavorited });
        }
      })
      .catch((err) => {
        console.error("[useFavorite] API call failed:", err);
        // Revert on failure.
        console.log("[useFavorite] Reverting to: favorited=", favorited, "count=", count);
        onChange({ viewerHasFavorited: favorited, favorites: count });
      })
      .finally(() => {
        console.log("[useFavorite] finally, setting pending=false");
        setPending(false);
      });
  }, [adId, favorited, count, isAuthenticated, viewerId, router, onChange]);

  return { pending, toggle };
}