/**
 * useGlobalSearch — hook for debounced, ranked global search.
 *
 * Provides instant search with smooth UX:
 * - Debounced input (300ms) to avoid excessive re-renders
 * - Memoized filtering using React's useMemo
 * - Supports both instant (while typing) and submit mode
 * - Searches both ads and users
 * - Backend-ready: swap searchGlobalMixed for a server call
 *
 * Usage:
 * ```tsx
 * const {
 *   query, setQuery, results, hasQuery, clear, submit,
 *   ads, users, loading, count
 * } = useGlobalSearch();
 *
 * return (
 *   <>
 *     <input value={query} onChange={(e) => setQuery(e.target.value)} />
 *     <p>{count} results found</p>
 *     <SearchResults results={results} query={query} />
 *   </>
 * );
 * ```
 */

"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { SearchResultAd, SearchResultUser } from "@/types";

export interface UseGlobalSearchOptions {
  /** Debounce delay in milliseconds. Default: 200 */
  debounceMs?: number;
  /** Minimum characters before searching. Default: 1 */
  minChars?: number;
}

export interface UseGlobalSearchReturn {
  /** Current search query (raw, unnormalized) */
  query: string;
  /** Set the search query */
  setQuery: (q: string) => void;
  /** Combined search results (ads + users), sorted by relevance */
  results: (SearchResultAd | SearchResultUser)[];
  /** Filtered advertisements only */
  ads: SearchResultAd[];
  /** Filtered users only */
  users: SearchResultUser[];
  /** Whether a search is in progress (debounce pending) */
  loading: boolean;
  /** Number of results found (excluding empty query) */
  count: number;
  /** Reset search to show nothing */
  clear: () => void;
  /** Submit current query immediately (bypass debounce) */
  submit: () => void;
  /** Whether there's an active query */
  hasQuery: boolean;
}

export function useGlobalSearch(
  options: UseGlobalSearchOptions = {},
): UseGlobalSearchReturn {
  const {
    debounceMs = 200,
    minChars = 1,
  } = options;

  const [rawQuery, setRawQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const setQuery = useCallback((q: string) => {
    setRawQuery(q);
    
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    
    const trimmed = q.trim();
    if (trimmed.length < minChars) {
      // Immediately clear for very short queries
      setActiveQuery("");
      return;
    }
    
    // Debounce
    debounceTimer.current = setTimeout(() => {
      setActiveQuery(trimmed);
    }, debounceMs);
  }, [debounceMs, minChars]);

  const submit = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setActiveQuery(rawQuery.trim());
  }, [rawQuery]);

  const clear = useCallback(() => {
    setRawQuery("");
    setActiveQuery("");
  }, []);

  const hasQuery = activeQuery.length > 0;

  // Memoize search results — but note: searchGlobalMixed is async
  // So we use a ref to store the latest results and sync them
  const resultsRef = useRef<(SearchResultAd | SearchResultUser)[]>([]);
  const [cachedResults, setCachedResults] = useState<(SearchResultAd | SearchResultUser)[]>([]);

  // Perform the async search when activeQuery changes
  useEffect(() => {
    if (!hasQuery) {
      setCachedResults([]);
      return;
    }

    let cancelled = false;

    fetch(`/api/search?q=${encodeURIComponent(activeQuery)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const results = data?.results ?? [];
        resultsRef.current = results;
        setCachedResults(results);
      })
      .catch(() => {
        if (!cancelled) {
          resultsRef.current = [];
          setCachedResults([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeQuery, hasQuery]);

  const results = cachedResults;

  const ads = useMemo(() => {
    return results.filter((r): r is SearchResultAd => r.type === "ad");
  }, [results]);

  const users = useMemo(() => {
    return results.filter((r): r is SearchResultUser => r.type === "user");
  }, [results]);

  const count = useMemo(() => {
    if (!hasQuery) return 0;
    return results.length;
  }, [hasQuery, results.length]);

  return {
    query: rawQuery,
    setQuery,
    results,
    ads,
    users,
    loading: rawQuery !== activeQuery && rawQuery.trim().length >= minChars,
    count,
    clear,
    submit,
    hasQuery,
  };
}