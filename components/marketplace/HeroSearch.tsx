"use client";

import { useRouter } from "@/i18n/routing";
import { SearchBar } from "@/components/marketplace/SearchBar";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import type { Product } from "@/types";

interface HeroSearchProps {
  /** Products for legacy instant search fallback */
  products?: Product[];
}

/**
 * HeroSearch - Main search component for the marketplace homepage.
 *
 * Uses the existing SearchBar component with live search dropdown
 * powered by useGlobalSearch hook and SearchRepository.
 *
 * Features:
 * - Live search while typing (debounced)
 * - Dropdown with ads and users
 * - Press Enter to submit full search
 * - Backend-ready via searchRepository
 */
export function HeroSearch({ products }: HeroSearchProps) {
  const router = useRouter();

  // Use the global search hook for live search
  const {
    ads,
    users,
    hasQuery,
    count,
    loading,
    clear,
    setQuery,
    query: rawQuery,
  } = useGlobalSearch({ debounceMs: 200, minChars: 1 });

  // Total results for dropdown
  const totalResults = ads.length + users.length;

  const handleClear = () => {
    clear();
    // No navigation needed - stay on homepage
  };

  const handleSelectResult = (result: { type: string; id: string }) => {
    if (result.type === "ad") {
      router.push(`/product/${result.id}`);
    } else if (result.type === "user") {
      const user = users.find((u) => u.id === result.id);
      if (user) {
        router.push(`/u/${user.username}`);
      }
    }
  };

  return (
    <div className="w-full max-w-3xl relative">
      <SearchBar
        size="lg"
        query={rawQuery}
        onQueryChange={setQuery}
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
  );
}