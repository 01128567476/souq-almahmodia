/**
 * SearchBar — Professional search input with instant global search dropdown.
 *
 * Features:
 * - Debounced instant search (while typing)
 * - Global search across ads AND users
 * - Smart text highlighting using HighlightText React component (no HTML strings)
 * - Arabic and English support
 * - Relevance-ranked results
 * - Professional empty state
 * - Responsive design
 * - Enter key to submit
 *
 * Backend-ready: receives search state from parent (SearchView)
 * which uses useGlobalSearch hook backed by searchRepository.
 *
 * Props-based architecture:
 * - Parent component manages search state via useGlobalSearch
 * - SearchBar is a pure UI component that displays results
 * - No duplicate hooks, no state conflicts
 */

"use client";

import { useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/utils/cn";
import { HighlightText } from "@/components/marketplace/HighlightText";
import type { Product, SearchResultAd, SearchResultUser } from "@/types";
import { useState } from "react";
import { rankAdsByQuery } from "@/utils/adSearch";

export interface SearchBarProps {
  size?: "md" | "lg";
  /** Current search query (displayed in the input) */
  query?: string;
  /** Called when the query changes */
  onQueryChange?: (q: string) => void;
  /** Search results — ads only (no users, users shown separately) */
  ads?: SearchResultAd[];
  /** Search results — users only */
  users?: SearchResultUser[];
  /** Whether a search query is active */
  hasQuery?: boolean;
  /** Total number of results */
  count?: number;
  /** Whether search is loading */
  loading?: boolean;
  /** Called when the user clicks clear */
  onClear?: () => void;
  /** Called when the user selects a result (type + id) */
  onSelectResult?: (result: { type: string; id: string }) => void;
  /** When provided, enables instant client-side search with highlighting */
  products?: Product[];
  /** Enable instant (debounced) search mode */
  instantSearch?: boolean;
}

export function SearchBar({
  size = "md",
  query = "",
  onQueryChange,
  ads = [],
  users = [],
  hasQuery = false,
  count = 0,
  loading = false,
  onClear,
  onSelectResult: externalOnSelectResult,
  products,
  instantSearch = false,
}: SearchBarProps) {
  const t = useTranslations();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const [showResults, setShowResults] = useState(false);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        resultsContainerRef.current &&
        !resultsContainerRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = (query ?? "").trim();
      if (q) {
        router.push(`${ROUTES.search}?q=${encodeURIComponent(q)}`);
      } else {
        router.push(ROUTES.search);
      }
      setShowResults(false);
    },
    [query, router],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (onQueryChange) {
        onQueryChange(val);
      }
      setShowResults(val.trim().length > 0);
    },
    [onQueryChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleSubmit(e as unknown as React.FormEvent);
      } else if (e.key === "Escape") {
        setShowResults(false);
        inputRef.current?.blur();
      }
    },
    [handleSubmit],
  );

  const defaultHandleSelectResult = useCallback(
    (result: { type: string; id: string }) => {
      setShowResults(false);
      if (result.type === "ad") {
        router.push(`/product/${result.id}`);
      } else if (result.type === "user") {
        const user = users.find((u) => u.id === result.id);
        if (user) {
          router.push(`/u/${user.username}`);
        }
      }
    },
    [router, users],
  );

  const handleSelectResult = externalOnSelectResult ?? defaultHandleSelectResult;

  const handleClear = useCallback(() => {
    if (onClear) {
      onClear();
    }
    if (onQueryChange) {
      onQueryChange("");
    }
    setShowResults(false);
    inputRef.current?.focus();
  }, [onClear, onQueryChange]);

  // Check if we have any search results to show
  const hasResults = hasQuery && (ads.length > 0 || users.length > 0);

  return (
    <div className="relative w-full" ref={resultsContainerRef} role="search">
      <form onSubmit={handleSubmit} className="relative w-full">
        <Icon
          name="search"
          className="absolute start-4 top-1/2 -translate-y-1/2 text-outline"
          size={20}
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.trim().length > 0 || instantSearch) {
              setShowResults(true);
            }
          }}
          placeholder={t("common.searchPlaceholder")}
          aria-label={t("common.search")}
          aria-autocomplete="list"
          aria-expanded={showResults}
          aria-controls="search-results"
          role="combobox"
          tabIndex={0}
          className={cn(
            "w-full ps-12 pe-28 bg-surface-container-lowest border border-outline-variant rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all",
            "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-cancel-button]:hidden",
            "[&::-ms-clear]:hidden",
            size === "lg" ? "py-4 text-body-lg" : "py-3 text-body-md",
          )}
        />
        {/* Clear button when query exists */}
        {query && query.trim().length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute end-24 top-1/2 -translate-y-1/2 p-1.5 text-outline hover:text-on-surface-variant transition-colors"
            aria-label={t("common.reset")}
          >
            <Icon name="close" size={18} />
          </button>
        )}
        <button
          type="submit"
          className="absolute end-2 top-1/2 -translate-y-1/2 bg-primary text-on-primary px-5 py-2 rounded-lg font-label-md text-label-md font-bold hover:opacity-90 active:scale-95 transition-all"
        >
          {t("common.search")}
        </button>
      </form>

      {/* Global search results dropdown */}
      {showResults && hasQuery && (
        <div
          id="search-results"
          role="listbox"
          className="absolute z-50 mt-2 w-full max-w-2xl rounded-xl border border-outline-variant bg-surface-container-lowest shadow-xl"
        >
          {/* Loading state */}
          {loading && (
            <div className="px-4 py-6 text-center">
              <div className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-body-sm text-on-surface-variant">
                  {t("common.loading")}
                </span>
              </div>
            </div>
          )}

          {/* Results */}
          {hasResults && !loading && (
            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              {/* Results count header */}
              <div className="border-b border-outline-variant px-4 py-2 text-xs font-body-sm text-on-surface-variant bg-surface-container">
                {count} {t("search.resultsFound")}
              </div>

              {/* Users section */}
              {users.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-body-sm font-semibold text-on-surface-variant bg-surface-container-low">
                    {t("search.users")}
                  </div>
                  {users.slice(0, 3).map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectResult({ type: "user", id: user.id })}
                      role="option"
                      aria-selected="false"
                      className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-surface-container-low border-b border-outline-variant/50 last:border-b-0"
                    >
                      <Image
                        src={user.avatar}
                        alt={user.displayName}
                        width={40}
                        height={40}
                        className="flex-shrink-0 h-10 w-10 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-body-sm font-body-sm text-on-surface">
                          <HighlightText text={user.displayName} query={query} />
                        </div>
                        <div className="text-xs font-body-sm text-on-surface-variant">
                          @{user.username}
                          {user.adsCount > 0 && (
                            <span className="ms-2">
                              {" "}
                              · {user.adsCount} {t("search.ads")}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Ads section */}
              {ads.length > 0 && (
                <div>
                  {users.length > 0 && (
                    <div className="px-4 py-2 text-xs font-body-sm font-semibold text-on-surface-variant bg-surface-container-low">
                      {t("search.ads")}
                    </div>
                  )}
                  {ads.slice(0, 5).map((ad) => (
                    <button
                      key={ad.id}
                      onClick={() => handleSelectResult({ type: "ad", id: ad.id })}
                      role="option"
                      aria-selected="false"
                      className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-surface-container-low border-b border-outline-variant/50 last:border-b-0"
                    >
                      <Image
                        src={ad.image}
                        alt={ad.title}
                        width={48}
                        height={48}
                        className="flex-shrink-0 h-12 w-12 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-body-sm font-body-sm text-on-surface truncate">
                          <HighlightText text={ad.title} query={query} />
                        </div>
                        <div className="text-xs font-body-sm text-on-surface-variant">
                          <span className="font-semibold text-on-surface">
                            {ad.price.toLocaleString()} {ad.currency}
                          </span>
                          {ad.location && (
                            <span className="ms-2">
                              {" "}
                              · {ad.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state - no results */}
          {hasQuery && !hasResults && !loading && (
            <div className="px-4 py-8 text-center">
              <div className="mb-3 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container">
                  <Icon name="search_off" size={24} className="text-outline" />
                </div>
              </div>
              <p className="text-body-sm text-on-surface-variant">
                {t("search.noAdsOrUsers")}
              </p>
              <button
                type="button"
                onClick={handleClear}
                className="mt-3 text-body-sm font-body-sm text-primary hover:text-primary hover:underline"
              >
                {t("common.reset")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Legacy product dropdown (when products prop provided without global search) */}
      {!hasQuery && instantSearch && products && query.trim().length > 0 && (
        <LegacyProductDropdown
          query={query}
          products={products}
          onSelect={() => setShowResults(false)}
          t={t}
        />
      )}
    </div>
  );
}

/** Legacy dropdown for product-only instant search (when products prop is provided). */
function LegacyProductDropdown({
  query,
  products,
  onSelect,
  t,
}: {
  query: string;
  products: Product[];
  onSelect: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const { filteredProducts } = useProductFilter(products, query);

  if (!query.trim() || products.length === 0) return null;
  if (filteredProducts.length === 0) return null;

  return (
    <div className="rounded-b-xl border-x border-b border-outline-variant bg-surface-container-lowest shadow-xl">
      <div className="max-h-80 overflow-y-auto custom-scrollbar">
        <div className="border-b border-outline-variant px-4 py-2 text-xs font-body-sm text-on-surface-variant">
          {filteredProducts.length} {t("search.resultsFound")}
        </div>
        {filteredProducts.map(({ product }) => (
          <button
            key={product.id}
            onClick={onSelect}
            role="option"
            aria-selected="false"
            className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-surface-container-low"
          >
            <Image
              src={product.image}
              alt={product.title}
              width={48}
              height={48}
              className="flex-shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="text-body-sm font-body-sm text-on-surface">
                <HighlightText text={product.title} query={query} />
              </div>
              <div className="text-xs font-body-sm text-on-surface-variant">
                {product.price.toLocaleString()} {product.currency}
                {product.sellerName && (
                  <span className="ms-2">
                    {" "}
                    · {product.sellerName}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Hook to filter products by query tokens. Uses the unified searchRepository.rankAdsByQuery for consistent ranking. */
function useProductFilter(products: Product[], query: string) {
  const ranked = query.trim()
    ? rankAdsByQuery(products, query)
    : products.map((p) => ({ ...p, score: 0 }));

  const filteredProducts: Array<{ product: Product; score: number }> = ranked
    .filter((r) => (r as Product & { score: number }).score > 0)
    .map((r) => ({ product: r as Product, score: (r as { score: number }).score }));

  return { filteredProducts };
}
