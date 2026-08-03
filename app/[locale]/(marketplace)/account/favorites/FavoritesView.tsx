"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useEngagementStatsBatch } from "@/hooks/useEngagementStats";
import type { Product } from "@/types";

/**
 * Favorites list, driven by the shared engagement stats — the single source of
 * truth for "is this favorited". Every card here is favorited by definition, so
 * its heart is always filled; un-favoriting flips `viewerHasFavorited` in the
 * batch, which removes the card from this list live (no refresh, no refetch).
 */
export function FavoritesView({ products }: { products: Product[] }) {
  const t = useTranslations("account");

  const ids = useMemo(() => products.map((p) => p.id), [products]);
  const { stats, loading, patchStats } = useEngagementStatsBatch(ids);

  const favorites = useMemo(
    () => products.filter((p) => stats[p.id]?.viewerHasFavorited),
    [products, stats],
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-lg">
        {ids.slice(0, 3).map((id) => (
          <div key={id} className="h-80 animate-pulse rounded-xl bg-surface-container" />
        ))}
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <EmptyState
        icon="favorite_border"
        title={t("noFavorites")}
        description={t("noFavoritesSub")}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-lg">
      {favorites.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          stats={stats[product.id]}
          onStatsChange={patchStats}
        />
      ))}
    </div>
  );
}
