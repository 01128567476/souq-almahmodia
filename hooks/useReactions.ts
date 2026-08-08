"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { ReactionSummary, ReactionType } from "@/types";

interface UseReactionsResult {
  summary: ReactionSummary | null;
  loading: boolean;
  pending: boolean;
  isAuthenticated: boolean;
  react: (type: ReactionType) => void;
}

const DEFAULT_SUMMARY: ReactionSummary = {
  total: 0,
  counts: { like: 0, love: 0, funny: 0, wow: 0, sad: 0 },
  viewerReaction: null,
};

/**
 * Reactions hook — architecture-level fix for stale fetch overwrite.
 *
 * FIX (2026-08-08):
 * - Request ID system: each fetch gets unique ID, stale responses ignored
 * - lastMutationAt timestamp: fetches started before mutation are stale
 * - useEffect ONLY depends on adId + viewerId (NOT summary or mutation results)
 * - No refetch inside react() or optimistic update
 * - Server response is the ONLY source of truth after mutation
 * - Hard execution lock prevents duplicate mutations
 */
export function useReactions(adId: string): UseReactionsResult {
  const { user, isAuthenticated } = useAuth();
  const viewerId = user?.id ?? null;

  const [summary, setSummary] = useState<ReactionSummary | null>({ ...DEFAULT_SUMMARY });
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  // Stale response protection
  const fetchRequestId = useRef(0);
  const lastMutationAt = useRef(0);

  // Execution lock
  const inFlight = useRef(false);

  // Initial fetch tracking
  const hasInitialFetched = useRef(false);
  const lastViewerId = useRef<string | null>(null);

  /**
   * Fetch reaction summary — with request ID for stale detection.
   * Returns the request ID so caller can verify response is not stale.
   */
  const doFetch = useCallback(async (): Promise<{ requestId: number; summary: ReactionSummary | null }> => {
    const requestId = ++fetchRequestId.current;
    console.log("[useReactions] FETCH START id=", requestId);

    try {
      const params = new URLSearchParams();
      if (viewerId) params.set("viewerId", viewerId);
      const url = `/api/ads/${adId}/reactions?${params}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        console.log("[useReactions] FETCH IGNORED (stale) if requestId=", requestId);
        return { requestId, summary: null };
      }
      const data = await res.json();
      const fetchedSummary = data?.summary ?? null;

      // Verify this response is still the latest fetch
      if (requestId !== fetchRequestId.current) {
        console.log("[useReactions] FETCH IGNORED (stale) id=", requestId, "current=", fetchRequestId.current);
        return { requestId, summary: null };
      }

      // Verify no newer mutation happened after this fetch started
      if (lastMutationAt.current > 0) {
        console.log("[useReactions] FETCH IGNORED (mutation happened after fetch) id=", requestId);
        return { requestId, summary: null };
      }

      console.log("[useReactions] FETCH APPLIED id=", requestId, "summary=", fetchedSummary);
      return { requestId, summary: fetchedSummary };
    } catch (err) {
      console.error("[useReactions] FETCH FAILED id=", requestId, err);
      return { requestId, summary: null };
    }
  }, [adId, viewerId]);

  /**
   * Initial load — runs ONLY when adId or viewerId changes.
   * NOT triggered by summary changes or mutation results.
   */
  useEffect(() => {
    let active = true;

    // Skip if viewerId hasn't changed and we already fetched
    if (viewerId === lastViewerId.current && hasInitialFetched.current) {
      return;
    }

    console.log("[useReactions] useEffect triggering fetch for adId=", adId, "viewerId=", viewerId);

    setLoading(true);
    doFetch()
      .then(({ requestId, summary }) => {
        if (!active) return;
        // Only apply if this is still the latest request and no mutation happened
        if (requestId === fetchRequestId.current && lastMutationAt.current === 0) {
          setSummary(summary ?? { ...DEFAULT_SUMMARY });
          hasInitialFetched.current = true;
          lastViewerId.current = viewerId;
          console.log("[useReactions] Initial fetch applied, viewerId=", viewerId);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [adId, viewerId, doFetch]);

  /**
   * react() — mutation function with full stale protection.
   *
   * GUARANTEES:
   * 1. Only ONE call executes at a time (inFlight lock)
   * 2. Sets lastMutationAt timestamp BEFORE optimistic update
   * 3. All pending/in-flight fetches will ignore their responses (stale detection)
   * 4. Server response becomes the ONLY state source after mutation
   * 5. No refetch after mutation
   */
  const react = useCallback(
    (type: ReactionType) => {
      console.log("[useReactions] MUTATION START type=", type);

      // HARD EXECUTION LOCK — prevent duplicate calls
      if (inFlight.current) {
        console.log("[useReactions] MUTATION BLOCKED (inFlight)");
        return;
      }

      inFlight.current = true;
      setPending(true);

      // CRITICAL: Mark mutation time BEFORE optimistic update
      // Any fetch that started before this timestamp is potentially stale
      lastMutationAt.current = Date.now();
      const mutationTimestamp = lastMutationAt.current;

      // Detect isRemoving from current state
      const currentSummary = summary ?? { ...DEFAULT_SUMMARY };
      const isRemoving = currentSummary.viewerReaction === type;

      // Optimistic update (will be overwritten by server response if needed)
      setSummary((prev) => {
        const current = prev ?? { ...DEFAULT_SUMMARY };
        const nextCounts = { ...current.counts };
        const isRemovingFromPrev = current.viewerReaction === type;

        if (current.viewerReaction) {
          nextCounts[current.viewerReaction] = Math.max(0, nextCounts[current.viewerReaction] - 1);
        }

        if (!isRemovingFromPrev) {
          nextCounts[type] = (nextCounts[type] ?? 0) + 1;
        }

        const nextTotal = Object.values(nextCounts).reduce((s: number, n: number) => s + n, 0);

        return {
          counts: nextCounts,
          total: nextTotal,
          viewerReaction: isRemovingFromPrev ? null : type,
        };
      });

      // Build URL
      const url = new URL(`/api/ads/${adId}/reactions`, window.location.origin);
      if (isRemoving) {
        url.searchParams.set("remove", "true");
      }

      // Call API
      fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
        cache: "no-store",
      })
        .then((res) => {
          console.log("[useReactions] API response status=", res.status);
          if (!res.ok) throw new Error(`POST failed: ${res.status}`);
          return res.json();
        })
        .then((data) => {
          // Check if a NEWER mutation happened while waiting
          if (lastMutationAt.current > mutationTimestamp) {
            console.log("[useReactions] MUTATION IGNORED (newer mutation happened)");
            return;
          }

          const serverSummary = data?.summary ?? null;
          console.log("[useReactions] MUTATION END, server summary=", serverSummary);

          // Server response BECOMES the state — no merge, no refetch
          setSummary(serverSummary ?? { ...DEFAULT_SUMMARY });
        })
        .catch((err) => {
          console.error("[useReactions] API call failed:", err);
          // On error, refetch to get authoritative state
          doFetch().then(({ requestId, summary }) => {
            // Only apply if no newer mutation happened
            if (requestId === fetchRequestId.current && lastMutationAt.current === mutationTimestamp) {
              setSummary(summary ?? { ...DEFAULT_SUMMARY });
            }
          });
        })
        .finally(() => {
          // Release lock — mutation complete
          inFlight.current = false;
          setPending(false);
          console.log("[useReactions] MUTATION COMPLETE, lock released");
        });
    },
    [adId, viewerId, summary, doFetch],
  );

  return { summary, loading, pending, isAuthenticated, react };
}