/**
 * SearchView - Professional marketplace search results view with global search.
 *
 * Features:
 * - Global search across ads AND users via useGlobalSearch hook
 * - Smart text highlighting using HighlightText React component (no HTML strings)
 * - Arabic and English support
 * - Relevance-ranked results
 * - Professional empty state
 * - Smooth transitions
 * - Backend-ready architecture
 *
 * Architecture:
 * 1. Parent page passes initial `query` prop (from server-side searchParams)
 * 2. When query changes, triggers hook's setQuery
 * 3. useGlobalSearch calls searchRepository.searchGlobalMixed()
 * 4. Results flow back: hook -> SearchView -> SearchBar (for dropdown) + results grid
 */

"use client";

import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { SearchBar } from "@/components/marketplace/SearchBar";
import { SearchEmptyState } from "@/components/marketplace/SearchEmptyState";
import { HighlightText } from "@/components/marketplace/HighlightText";
import { Icon } from "@/components/ui/Icon";
import { ROUTES } from "@/constants/routes";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import type { Product, SearchResultAd, SearchResultUser } from "@/types";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { SafeAvatar, SafeProductImage } from "@/components/ui/SafeImage";

export function SearchView({ products, query: initialQuery }: { products: Product[]; query?: string }) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Prefer initialQuery from server props, fallback to URL query param
  const urlQuery = searchParams.get("q") ?? "";
  const serverQuery = initialQuery ?? "";
  const urlQueryFromServer = serverQuery || urlQuery;

  // Use global search hook (async, debounced)
  const {
    results,
    ads,
    users,
    hasQuery,
    count,
    loading,
    clear,
    setQuery: setGlobalQuery,
    query: rawQuery,
  } = useGlobalSearch({ debounceMs: 300, minChars: 1 });

  // Sync URL query param -> hook's setQuery.
  // This handles direct navigation like /?q=hassan and URL changes.
  // Key fix: Only sync when URL query is NON-EMPTY. When clearing, URL becomes
  // empty BEFORE the useEffect runs, so we never re-sync the old query back.
  const lastSyncedQueryRef = useRef<string>("");
  useEffect(() => {
    if (urlQueryFromServer && urlQueryFromServer !== lastSyncedQueryRef.current) {
      setGlobalQuery(urlQueryFromServer);
      lastSyncedQueryRef.current = urlQueryFromServer;
    } else if (!urlQueryFromServer) {
      lastSyncedQueryRef.current = "";
    }
  }, [urlQueryFromServer, setGlobalQuery, pathname]);

  // Display query priority:
  // 1. rawQuery from hook (user is typing or just cleared)
  // 2. urlQueryFromServer ONLY when rawQuery is empty AND not yet synced
  //    (handles direct navigation like /?q=xyz on page load)
  // After sync completes, lastSyncedQueryRef matches URL, so fallback returns "".
  const displayQuery = rawQuery || (urlQueryFromServer !== lastSyncedQueryRef.current ? urlQueryFromServer : "");

  const handleClear = useCallback(() => {
    clear();
    setGlobalQuery("");
    // Use replace instead of push to avoid browser history issues
    router.replace(pathname);
  }, [clear, router, pathname, setGlobalQuery]);

  // Combined results count
  const totalResults = ads.length + users.length;

  const handleSelectResult = useCallback(
    (result: { type: string; id: string }) => {
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Search Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Icon name="search" size={24} className="text-primary" />
          </div>
          <div>
            <h1 className="text-headline-sm font-headline-sm text-on-surface">
              {t("search.title")}
            </h1>
          </div>
        </div>

        {/* Search Bar - receives hook results as props */}
        <div className="max-w-2xl">
          <SearchBar
            size="lg"
            query={displayQuery}
            onQueryChange={(q) => {
              setGlobalQuery(q);
            }}
            ads={ads}
            users={users}
            hasQuery={hasQuery}
            count={totalResults}
            loading={loading}
            onClear={handleClear}
            onSelectResult={handleSelectResult}
            products={products}
            instantSearch
          />
        </div>

        {/* Results Count */}
        {hasQuery && totalResults > 0 && !loading && (
          <p className="mt-4 text-body-sm font-body-sm text-on-surface-variant">
            {t("search.resultsCount", { count: totalResults })}
            {displayQuery && (
              <span className="ms-1 font-bold text-on-surface">
                {String.fromCharCode(34) + displayQuery + String.fromCharCode(34)}
              </span>
            )}
          </p>
        )}

        {hasQuery && totalResults === 0 && !loading && (
          <p className="mt-4 text-body-sm font-body-sm text-on-surface-variant">
            {t("search.noResultsTitle")}
          </p>
        )}
      </div>

      {/* Loading State */}
      {hasQuery && loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-body-sm text-on-surface-variant">
              {t("common.loading")}
            </span>
          </div>
        </div>
      )}

      {/* Results or Empty State */}
      {hasQuery && totalResults === 0 && !loading ? (
        <SearchEmptyState query={displayQuery} onClear={handleClear} />
      ) : hasQuery && totalResults > 0 && !loading ? (
        /* Global Search Results - Users + Ads */
        <div className="space-y-8">
          {/* Users Section */}
          {users.length > 0 && (
            <div>
              <h2 className="text-label-md font-label-md font-semibold text-on-surface mb-4 flex items-center gap-2">
                <Icon name="person" size={20} className="text-primary" />
                {t("search.users")} ({users.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => router.push(`/u/${user.username}`)}
                    className="flex items-center gap-4 p-4 rounded-xl border border-outline-variant bg-surface-container-lowest hover:bg-surface-container transition-all text-start group"
                  >
                    <SafeAvatar
                      src={user.avatar}
                      name={user.displayName}
                      width={56}
                      height={56}
                      className="flex-shrink-0 h-14 w-14 ring-2 border border-outline"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-body-sm font-body-sm font-semibold text-on-surface truncate">
                        <HighlightText text={user.displayName} query={displayQuery} />
                      </div>
                      <div className="text-sm font-body-sm text-on-surface-variant truncate">
                        <span>@</span><HighlightText text={user.username} query={displayQuery} />
                      </div>
                      {user.adsCount > 0 && (
                        <div className="text-xs font-body-sm text-on-surface-variant/70 mt-1">
                          {user.adsCount} {t("search.ads")}
                        </div>
                      )}
                    </div>
                    <Icon
                      name="arrow_forward"
                      size={20}
                      className="text-outline group-hover:text-primary transition-colors flex-shrink-0"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ads Section */}
          {ads.length > 0 && (
            <div>
              <h2 className="text-label-md font-label-md font-semibold text-on-surface mb-4 flex items-center gap-2">
                <Icon name="store" size={20} className="text-primary" />
                {t("search.ads")} ({ads.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {ads.map((ad) => (
                  <button
                    key={ad.id}
                    onClick={() => router.push(`/product/${ad.id}`)}
                    className="flex flex-col rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden hover:border-primary/50 hover:shadow-md transition-all text-start group"
                  >
                    {/* Ad Image */}
                    <div className="relative aspect-square overflow-hidden bg-surface-container">
                      <SafeProductImage
                        src={ad.image}
                        alt={ad.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    {/* Ad Info */}
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="text-body-sm font-body-sm text-on-surface line-clamp-2 flex-1">
                        <HighlightText text={ad.title} query={displayQuery} />
                      </div>
                      <div className="text-label-md font-label-md font-bold text-primary mt-2">
                        {ad.price.toLocaleString()} {ad.currency}
                      </div>
                      {ad.location && (
                        <div className="text-xs font-body-sm text-on-surface-variant mt-1 flex items-center gap-1">
                          <Icon name="location_on" size={14} />
                          <HighlightText text={ad.location} query={displayQuery} />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* No query - show all products */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}