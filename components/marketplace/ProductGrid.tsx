"use client";

import { useMemo } from "react";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { useEngagementStatsBatch } from "@/hooks/useEngagementStats";
import type { Product } from "@/types";

export function ProductGrid({ products }: { products: Product[] }) {
  // One batched stats request for the whole grid instead of one per card.
  const ids = useMemo(() => products.map((p) => p.id), [products]);
  const { stats, loading, patchStats } = useEngagementStatsBatch(ids);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-lg">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          stats={stats[product.id]}
          statsLoading={loading}
          onStatsChange={patchStats}
        />
      ))}
    </div>
  );
}
