import type { Product, SearchResult } from "@/types";
import { adRepository } from "@/services/repositories/adRepository";
import { userRepository } from "@/services/repositories/userRepository";
import { rankAdsByQuery } from "@/services/repositories/searchRepository";
import { normalizeSearchText } from "@/utils/search";

/**
 * Public marketplace data access.
 *
 * Thin async facade over `adRepository` so marketplace pages have a small,
 * intention-revealing API ("approved products", "search") while all real logic
 * and the single source of truth live in the repository. Every function is
 * async (REST-shaped); Server Components await them directly.
 */

/** Approved, non-expired ads for the home feed and search. */
export function getApprovedProducts(): Promise<Product[]> {
  return adRepository.listPublic();
}

/** A single ad by id (any status); the page decides what to show. */
export function getProductById(id: string): Promise<Product | null> {
  return adRepository.getById(id);
}

/** Public ads within a category (category page, related listings). */
export function getProductsByCategory(slug: string): Promise<Product[]> {
  return adRepository.listPublicByCategory(slug);
}

/** All of a user's own ads (My Ads), excluding deleted. */
export function getProductsByOwner(ownerId: string): Promise<Product[]> {
  return adRepository.listByOwner(ownerId);
}

/** Search across public ads by title. */
export function searchProducts(query: string): Promise<Product[]> {
  return adRepository.searchPublic(query);
}

/**
 * Global search across ads AND users.
 * Returns mixed results ranked by relevance (score).
 */
export async function searchGlobal(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Use the new semantic search engine
  const { searchGlobalMixed } = await import("@/services/repositories/searchRepository");
  const results = await searchGlobalMixed(trimmed);

  // Map to SearchResult format
  return results.map((r) => {
    if (r.type === "ad") {
      return {
        type: "ad" as const,
        id: r.id,
        title: r.title,
        price: r.price,
        currency: r.currency,
        image: r.image,
        location: r.location,
        sellerName: r.sellerName,
        postedAgoHours: r.postedAgoHours,
        categorySlug: r.categorySlug,
        ownerId: r.ownerId,
        score: r.score,
      };
    }
    return {
      type: "user" as const,
      id: r.id,
      displayName: r.displayName,
      username: r.username,
      avatar: r.avatar,
      adsCount: r.adsCount,
      joinedAt: r.joinedAt,
      score: r.score,
    };
  });
}

/**
 * Rank ads by query — returns ads with scores, sorted descending.
 * Uses the same semantic search engine as searchGlobal.
 */
export function rankProducts(query: string, ads: Product[]): (Product & { score: number })[] {
  return rankAdsByQuery(ads, query);
}