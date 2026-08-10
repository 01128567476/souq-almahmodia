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
 * Uses optimistic update with reconciliation from API response.
 * The API endpoint POST /api/ads/[id]/favorites is a proper toggle:
 *   - If favorited → removes it
 *   - If not favorited → adds it
 *   - Returns { favorited, count } consistently
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

    // Optimistic: flip immediately for instant feedback
    const next = !favorited;
    const newCount = Math.max(0, count + (next ? 1 : -1));

    // Apply optimistic update immediately
    onChange({
      viewerHasFavorited: next,
      favorites: newCount,
    });

    setPending(true);

    // Use POST as toggle (unified endpoint)
    fetch(`/api/ads/${adId}/favorites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to toggle favorite");
        return res.json();
      })
      .then((data) => {
        console.log("[FAVORITE] API response:", data);
        if (data?.success && data?.data) {
          // Sync with authoritative server response
          const serverCount = data.data.count ?? newCount;
          const serverFavorited = data.data.favorited ?? next;
          console.log("[FAVORITE] Server state:", { serverFavorited, serverCount });
          onChange({
            viewerHasFavorited: serverFavorited,
            favorites: serverCount,
          });
        }
        // If response is unexpected, keep optimistic state
      })
      .catch((err) => {
        console.error("[FAVORITE] Toggle error:", err);
        // Revert on failure
        onChange({
          viewerHasFavorited: favorited,
          favorites: count,
        });
      })
      .catch(() => {
        // Revert on failure
        onChange({
          viewerHasFavorited: favorited,
          favorites: count,
        });
      })
      .finally(() => {
        setPending(false);
      });
  }, [adId, favorited, count, isAuthenticated, viewerId, router, onChange]);

  return { pending, toggle };
}