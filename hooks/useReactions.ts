"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { ReactionSummary, ReactionType } from "@/types";

interface UseReactionsResult {
  summary: ReactionSummary | null;
  loading: boolean;
  /** True while a mutation is in flight (optimistic update settling). */
  pending: boolean;
  isAuthenticated: boolean;
  /** Toggle a reaction: sets it, or removes it if it's already the viewer's. */
  react: (type: ReactionType) => void;
}

/**
 * Owns the reaction state for one advertisement: initial load plus optimistic
 * set/change/remove. All data access goes through the API, so this hook is
 * completely decoupled from server-only repository modules.
 */
export function useReactions(adId: string): UseReactionsResult {
  const { user, isAuthenticated } = useAuth();
  const viewerId = user?.id ?? null;

  const [summary, setSummary] = useState<ReactionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  const fetchReactions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (viewerId) params.set("viewerId", viewerId);
      const res = await fetch(`/api/ads/${adId}/reactions?${params}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.summary ?? null;
    } catch {
      return null;
    }
  }, [adId, viewerId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchReactions()
      .then((data) => {
        if (active) setSummary(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [adId, viewerId, fetchReactions]);

  const react = useCallback(
    (type: ReactionType) => {
      console.log("[useReactions] react called, type:", type, "viewerId:", viewerId, "summary:", summary);
      
      if (!viewerId) {
        console.log("[useReactions] No viewerId, aborting");
        return;
      }

      // If summary is still loading (null), skip optimistic update but still attempt API call
      const isRemoving = summary?.viewerReaction === type;
      const prevSummary = summary;

      // Optimistic update so the UI feels instant (only if we have current state)
      if (prevSummary) {
        setSummary((prev) => (prev ? applyReaction(prev, type, isRemoving) : prev));
      }
      setPending(true);

      const url = new URL(`/api/ads/${adId}/reactions`, window.location.origin);
      if (isRemoving) {
        url.searchParams.set("remove", "true");
      }

      console.log("[useReactions] POST", url.toString());

      fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })
        .then((res) => {
          console.log("[useReactions] API response status:", res.status);
          return res.json();
        })
        .then((data) => {
          console.log("[useReactions] API response data:", data);
          setSummary(data?.summary ?? prevSummary);
        })
        .catch((err) => {
          console.error("[useReactions] API call failed:", err);
          // On failure, re-fetch authoritative state.
          fetchReactions().then(setSummary);
        })
        .finally(() => setPending(false));
    },
    [adId, viewerId, summary, fetchReactions],
  );

  return { summary, loading, pending, isAuthenticated, react };
}

/** Pure helper: compute the next summary for an optimistic reaction change. */
function applyReaction(
  prev: ReactionSummary,
  type: ReactionType,
  isRemoving: boolean,
): ReactionSummary {
  const counts = { ...prev.counts };
  const current = prev.viewerReaction;

  if (current) counts[current] = Math.max(0, counts[current] - 1);
  if (!isRemoving) counts[type] += 1;

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return {
    counts,
    total,
    viewerReaction: isRemoving ? null : type,
  };
}