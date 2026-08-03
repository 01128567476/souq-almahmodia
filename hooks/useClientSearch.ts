/**
 * Client-side search hook with debouncing and memoization.
 *
 * Provides instant search with smooth UX:
 * - Debounced input (300ms) to avoid excessive re-renders
 * - Memoized filtering using React's useMemo
 * - Supports both instant (while typing) and submit modes
 * - Works with any Product[] dataset
 *
 * Backend-ready: swap `searchProductsRanked` for a server call without
 * changing the hook's interface.
 */

"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { searchProductsRanked, tokenize } from "@/utils/search";
import type { Product } from "@/types";

export interface UseClientSearchOptions {
  /** Debounce delay in milliseconds. Default: 300 */
  debounceMs?: number;
  /** Minimum characters before searching. Default: 1 */
  minChars?: number;
  /** Category names map for enhanced category matching. */
  categoryNames?: Map<string, string>;
}

export interface UseClientSearchReturn {
  /** Current search query (raw, un-normalized) */
  query: string;
  /** Set the search query */
  setQuery: (q: string) => void;
  /** Filtered products, sorted by relevance */
  results: Product[];
  /** Whether a search is in progress (debounce pending) */
  loading: boolean;
  /** Number of results found (excluding empty query) */
  count: number;
  /** Reset search to show all products */
  clear: () => void;
  /** Submit current query immediately (bypass debounce) */
  submit: () => void;
  /** Whether there's an active query */
  hasQuery: boolean;
}

/**
 * Hook that provides debounced, ranked product search.
 *
 * Usage:
 * ```tsx
 * const { query, setQuery, results, count, clear } = useClientSearch(products);
 *
 * return (
 *   <>
 *     <input value={query} onChange={(e) => setQuery(e.target.value)} />
 *     <p>{count} results found</p>
 *     <ProductGrid products={results} />
 *   </>
 * );
 * ```
 */
export function useClientSearch(
  products: Product[],
  options: UseClientSearchOptions = {},
): UseClientSearchReturn {
  const {
    debounceMs = 300,
    minChars = 1,
    categoryNames = new Map(),
  } = options;

  const [rawQuery, setRawQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(false);

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

  // Memoize search results
  const results = useMemo(() => {
    if (!hasQuery) return products;
    
    return searchProductsRanked(products, activeQuery, categoryNames)
      .map((r) => r.product);
  }, [products, activeQuery, hasQuery, categoryNames]);

  const count = useMemo(() => {
    if (!hasQuery) return 0;
    return results.length;
  }, [hasQuery, results.length]);

  return {
    query: rawQuery,
    setQuery,
    results,
    loading: rawQuery !== activeQuery && rawQuery.trim().length >= minChars,
    count,
    clear,
    submit,
    hasQuery,
  };
}