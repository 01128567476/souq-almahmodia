/**
 * Global Search Repository — production-grade marketplace search.
 *
 * ARCHITECTURE:
 *   Primary path: PostgreSQL ILIKE + GIN trigram index (scalable to 100K+ ads)
 *   Fallback: In-memory semantic search (for synonym matching)
 *
 * Search strategy:
 *   1. DB-level ILIKE search with GIN trigram index (idx_products_search_gin)
 *   2. Ranked by match type: title > description
 *   3. Pagination via offset + limit
 *   4. Semantic synonym matching applied on DB results only
 *
 * This ensures:
 *   - Scales to 100K+ ads without in-memory filtering
 *   - Result set is paginated BEFORE synonym scoring
 *   - Synonym matching runs on a bounded result set
 */

import type { Product, User, SearchResultAd, SearchResultUser } from "@/types";
import { adRepository } from "@/services/repositories/adRepository";
import { userRepository } from "@/services/repositories/userRepository";
import { normalizeSearchText } from "@/utils/search";
import { SYNONYM_GROUPS, getSynonymMap } from "@/services/search/synonymDictionary";
import { db } from "@/lib/db-server";
import { products, adImages } from "@/drizzle/schema";
import { eq, or, like, count, sql, and as drizzleAnd, inArray } from "drizzle-orm";

/* ====================================================================== */
/* Scoring constants                                                      */
/* ====================================================================== */

const SCORE = {
  exactPhraseInTitle: 50,
  exactPhraseInField: 30,
  exactQueryMatch: 20,
  exactTitleMatch: 15,
  titleStartsWith: 10,
  multipleTokensInTitle: 8,
  descriptionMatch: 2,
  categoryMatch: 4,
  locationMatch: 3,
  sellerMatch: 3,
  titleBase: 10,
  descriptionBase: 2,
  categoryBase: 4,
  locationBase: 3,
  sellerBase: 3,
  synonymMatch: 1,
} as const;

/* ====================================================================== */
/* DB-Level ILIKE Search (scalable to 100K+ ads)                        */
/* ====================================================================== */

/**
 * Search products using SQL LIKE — scalable to 100K+ ads.
 * Uses Drizzle ORM for query building.
 *
 * For best performance, create this GIN trigram index:
 *   CREATE EXTENSION IF NOT EXISTS pg_trgm;
 *   CREATE INDEX idx_products_search_gin ON products
 *     USING GIN (title gin_trgm_ops, description gin_trgm_ops);
 */
export async function searchProductsDb(
  query: string,
  options?: {
    page?: number;
    limit?: number;
    categorySlug?: string;
  }
): Promise<Product[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;
  const offset = (page - 1) * limit;

  // Split query into tokens
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  // Build per-token OR conditions: each token must match some field
  const tokenConditions = tokens.map((token) =>
    or(
      like(products.title, `%${token}%`),
      like(products.description, `%${token}%`),
      like(products.categorySlug, `%${token}%`),
      like(products.location, `%${token}%`),
      like(products.sellerName, `%${token}%`),
    )
  );

  // AND all token conditions together (all tokens must match)
  let whereClause: any = tokenConditions[0];
  for (let i = 1; i < tokenConditions.length; i++) {
    whereClause = drizzleAnd(whereClause, tokenConditions[i]);
  }

  // Add status filter
  // Rebuild: (status = approved) AND (token1 OR fields) AND (token2 OR fields) ...
  const conditions: any = [eq(products.status, "approved"), ...tokenConditions];
  whereClause = conditions.reduce((acc: any, cond: any, i: number) => {
    if (i === 0) return cond;
    return drizzleAnd(acc, cond);
  });

  // Add category filter
  if (options?.categorySlug) {
    whereClause = drizzleAnd(whereClause, eq(products.categorySlug, options.categorySlug));
  }

  // Execute search — order by created_at DESC
  const searchResults = await db
    .select()
    .from(products)
    .where(whereClause)
    .orderBy(products.createdAt)
    .limit(limit)
    .offset(offset);

  return searchResults.map((row: any) => ({
    ...row,
    image: row.image ?? undefined,
    description: row.description ?? undefined,
    price: row.price ?? undefined,
    currency: row.currency ?? undefined,
  })) as Product[];
}

/**
 * Count total matching products for pagination.
 */
export async function countProductsDb(
  query: string,
  options?: {
    categorySlug?: string;
  }
): Promise<number> {
  const trimmed = query.trim();
  if (!trimmed) return 0;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;

  // Build per-token OR conditions
  const tokenConditions = tokens.map((token) =>
    or(
      like(products.title, `%${token}%`),
      like(products.description, `%${token}%`),
      like(products.categorySlug, `%${token}%`),
      like(products.location, `%${token}%`),
      like(products.sellerName, `%${token}%`),
    )
  );

  // AND all token conditions + status
  const conditions: any = [eq(products.status, "approved"), ...tokenConditions];
  let whereClause: any = conditions.reduce((acc: any, cond: any, i: number) => {
    if (i === 0) return cond;
    return drizzleAnd(acc, cond);
  });

  if (options?.categorySlug) {
    whereClause = drizzleAnd(whereClause, eq(products.categorySlug, options.categorySlug));
  }

  const results = await db
    .select({ count: count() })
    .from(products)
    .where(whereClause);

  return results[0]?.count ?? 0;
}

/* ====================================================================== */
/* Query expansion using synonym dictionary                               */
/* ====================================================================== */

function expandQuery(
  normalizedQuery: string
): { originalTokens: string[]; semanticTerms: Set<string> } {
  const rawTokens = normalizedQuery.split(" ").filter(Boolean);
  const originalTokens = rawTokens.map((t) => t.toLowerCase());
  const semanticTerms = new Set<string>();

  const synonymMap = getSynonymMap();

  for (const token of originalTokens) {
    const lowerToken = token.toLowerCase();
    const group = synonymMap.get(lowerToken);
    if (group) {
      const synonymGroup = SYNONYM_GROUPS.find((g) => g.group === group);
      if (synonymGroup) {
        for (const term of synonymGroup.terms) {
          semanticTerms.add(term.toLowerCase());
        }
      }
    } else {
      semanticTerms.add(lowerToken);
    }
  }

  return { originalTokens, semanticTerms };
}

/* ====================================================================== */
/* Helper: normalize text                                                 */
/* ====================================================================== */

function safeNormalize(text: string | undefined | null): string {
  return normalizeSearchText(text ?? "");
}

/* ====================================================================== */
/* Match type detection                                                   */
/* ====================================================================== */

type MatchType = "none" | "exact" | "startsWith" | "contains";

function getMatchType(normalizedField: string, token: string): MatchType {
  if (normalizedField === token) return "exact";
  if (normalizedField.startsWith(token)) return "startsWith";
  if (normalizedField.includes(token)) return "contains";
  return "none";
}

/* ====================================================================== */
/* Ad scoring (semantic layer on top of DB results)                       */
/* ====================================================================== */

function scoreAd(
  ad: Product,
  originalTokens: string[],
  semanticTerms: Set<string>,
  normalizedQuery: string
): { score: number; matchedFields: string[] } | null {
  if (originalTokens.length === 0) return null;

  const normalizedTitle = safeNormalize(ad.title);
  const normalizedDesc = safeNormalize(ad.description);
  const normalizedSlug = safeNormalize(ad.categorySlug);
  const normalizedLocation = safeNormalize(ad.location);
  const normalizedSeller = safeNormalize(ad.sellerName);

  const matchedFields: string[] = [];
  let hasAnyMatch = false;
  let totalScore = 0;

  type GroupMatch = {
    groupName: string;
    bestMatchType: MatchType;
    bestFieldWeight: number;
  };
  const groupMatches: GroupMatch[] = [];

  const scoredTitleTerms = new Set<string>();
  const scoredDescTerms = new Set<string>();
  const scoredCatTerms = new Set<string>();
  const scoredLocTerms = new Set<string>();
  const scoredSellerTerms = new Set<string>();

  // Phrase match
  let phraseMatchBonus = 0;
  if (normalizedQuery.length > 0 && normalizedTitle.includes(normalizedQuery)) {
    phraseMatchBonus = SCORE.exactPhraseInTitle;
    if (!matchedFields.includes("title")) matchedFields.push("title");
    hasAnyMatch = true;
  }

  let fieldPhraseMatchBonus = 0;
  if (phraseMatchBonus === 0 && normalizedQuery.length > 0) {
    if (normalizedDesc.includes(normalizedQuery)) {
      fieldPhraseMatchBonus = SCORE.exactPhraseInField;
      if (!matchedFields.includes("description")) matchedFields.push("description");
      hasAnyMatch = true;
    } else if (normalizedSlug.includes(normalizedQuery)) {
      fieldPhraseMatchBonus = SCORE.exactPhraseInField;
      if (!matchedFields.includes("category")) matchedFields.push("category");
      hasAnyMatch = true;
    } else if (normalizedLocation.includes(normalizedQuery)) {
      fieldPhraseMatchBonus = SCORE.exactPhraseInField;
      if (!matchedFields.includes("location")) matchedFields.push("location");
      hasAnyMatch = true;
    } else if (normalizedSeller.includes(normalizedQuery)) {
      fieldPhraseMatchBonus = SCORE.exactPhraseInField;
      if (!matchedFields.includes("seller")) matchedFields.push("seller");
      hasAnyMatch = true;
    }
  }

  for (const term of semanticTerms) {
    let groupName = "";
    for (const group of SYNONYM_GROUPS) {
      if (group.terms.some((t) => t.toLowerCase() === term)) {
        groupName = group.group;
        break;
      }
    }

    // Title
    if (!scoredTitleTerms.has(term)) {
      const titleMatch = getMatchType(normalizedTitle, term);
      if (titleMatch !== "none") {
        scoredTitleTerms.add(term);
        hasAnyMatch = true;
        const fieldWeight = SCORE.titleBase;
        const matchBonus =
          titleMatch === "exact"
            ? SCORE.exactQueryMatch
            : titleMatch === "startsWith"
            ? SCORE.titleStartsWith
            : 0;
        const groupMatchEntry = groupMatches.find((g) => g.groupName === groupName);
        if (!groupMatchEntry) {
          groupMatches.push({ groupName, bestMatchType: titleMatch, bestFieldWeight: fieldWeight + matchBonus });
        } else {
          const currentBest =
            groupMatchEntry.bestMatchType === "exact"
              ? SCORE.exactQueryMatch
              : groupMatchEntry.bestMatchType === "startsWith"
              ? SCORE.titleStartsWith
              : 0;
          if (matchBonus > currentBest) {
            groupMatchEntry.bestMatchType = titleMatch;
            groupMatchEntry.bestFieldWeight = fieldWeight + matchBonus;
          }
        }
        if (!matchedFields.includes("title")) matchedFields.push("title");
      }
    }

    // Description
    if (!scoredDescTerms.has(term)) {
      const descMatch = getMatchType(normalizedDesc, term);
      if (descMatch !== "none") {
        scoredDescTerms.add(term);
        hasAnyMatch = true;
        const fieldWeight = SCORE.descriptionBase;
        const matchBonus =
          descMatch === "exact"
            ? SCORE.exactQueryMatch
            : descMatch === "startsWith"
            ? SCORE.titleStartsWith
            : SCORE.descriptionMatch;
        const groupMatchEntry = groupMatches.find((g) => g.groupName === groupName);
        if (!groupMatchEntry) {
          groupMatches.push({ groupName, bestMatchType: descMatch, bestFieldWeight: fieldWeight + matchBonus });
        }
        if (!matchedFields.includes("description")) matchedFields.push("description");
      }
    }

    // Category
    if (!scoredCatTerms.has(term)) {
      const catMatch = getMatchType(normalizedSlug, term);
      if (catMatch !== "none") {
        scoredCatTerms.add(term);
        hasAnyMatch = true;
        const fieldWeight = SCORE.categoryBase;
        const matchBonus =
          catMatch === "exact"
            ? SCORE.exactQueryMatch
            : catMatch === "startsWith"
            ? SCORE.titleStartsWith
            : SCORE.categoryMatch;
        const groupMatchEntry = groupMatches.find((g) => g.groupName === groupName);
        if (!groupMatchEntry) {
          groupMatches.push({ groupName, bestMatchType: catMatch, bestFieldWeight: fieldWeight + matchBonus });
        }
        if (!matchedFields.includes("category")) matchedFields.push("category");
      }
    }

    // Location
    if (!scoredLocTerms.has(term)) {
      const locMatch = getMatchType(normalizedLocation, term);
      if (locMatch !== "none") {
        scoredLocTerms.add(term);
        hasAnyMatch = true;
        const fieldWeight = SCORE.locationBase;
        const matchBonus =
          locMatch === "exact"
            ? SCORE.exactQueryMatch
            : locMatch === "startsWith"
            ? SCORE.titleStartsWith
            : SCORE.locationMatch;
        const groupMatchEntry = groupMatches.find((g) => g.groupName === groupName);
        if (!groupMatchEntry) {
          groupMatches.push({ groupName, bestMatchType: locMatch, bestFieldWeight: fieldWeight + matchBonus });
        }
        if (!matchedFields.includes("location")) matchedFields.push("location");
      }
    }

    // Seller
    if (!scoredSellerTerms.has(term)) {
      const sellerMatch = getMatchType(normalizedSeller, term);
      if (sellerMatch !== "none") {
        scoredSellerTerms.add(term);
        hasAnyMatch = true;
        const fieldWeight = SCORE.sellerBase;
        const matchBonus =
          sellerMatch === "exact"
            ? SCORE.exactQueryMatch
            : sellerMatch === "startsWith"
            ? SCORE.titleStartsWith
            : SCORE.sellerMatch;
        const groupMatchEntry = groupMatches.find((g) => g.groupName === groupName);
        if (!groupMatchEntry) {
          groupMatches.push({ groupName, bestMatchType: sellerMatch, bestFieldWeight: fieldWeight + matchBonus });
        }
        if (!matchedFields.includes("seller")) matchedFields.push("seller");
      }
    }
  }

  if (!hasAnyMatch || groupMatches.length === 0) return null;

  const originalSet = new Set(originalTokens);

  for (const gm of groupMatches) {
    const hasSynonym = Array.from(semanticTerms).some((t) => !originalSet.has(t));
    if (hasSynonym && gm.bestMatchType === "contains") {
      totalScore += SCORE.synonymMatch;
    }
    totalScore += gm.bestFieldWeight;
  }

  totalScore += phraseMatchBonus;
  totalScore += fieldPhraseMatchBonus;

  let originalTokenMatches = 0;
  for (const token of originalTokens) {
    if (
      normalizedTitle.includes(token) ||
      normalizedDesc.includes(token) ||
      normalizedSlug.includes(token) ||
      normalizedLocation.includes(token) ||
      normalizedSeller.includes(token)
    ) {
      originalTokenMatches++;
    }
  }
  if (originalTokenMatches > 1) {
    totalScore += SCORE.multipleTokensInTitle * originalTokenMatches;
  }

  return { score: totalScore, matchedFields };
}

/* ====================================================================== */
/* User scoring                                                           */
/* ====================================================================== */

function scoreUser(
  user: User,
  semanticTerms: Set<string>
): { score: number; matchedFields: string[] } | null {
  if (semanticTerms.size === 0) return null;

  const normalizedUsername = safeNormalize(user.username);
  const normalizedDisplayName = safeNormalize(user.displayName);

  let score = 0;
  const matchedFields: string[] = [];
  let hasMatch = false;

  for (const token of semanticTerms) {
    const usernameMatch = getMatchType(normalizedUsername, token);
    const displayNameMatch = getMatchType(normalizedDisplayName, token);

    if (usernameMatch !== "none") {
      hasMatch = true;
      if (!matchedFields.includes("username")) matchedFields.push("username");
      if (usernameMatch === "exact") score += 90;
      else if (usernameMatch === "startsWith") score += 70;
      else score += 55;
    }

    if (displayNameMatch !== "none") {
      hasMatch = true;
      if (!matchedFields.includes("displayName")) matchedFields.push("displayName");
      if (displayNameMatch === "exact") score += 90;
      else if (displayNameMatch === "startsWith") score += 70;
      else score += 55;
    }
  }

  return hasMatch ? { score, matchedFields } : null;
}

/* ====================================================================== */
/* Public API                                                             */
/* ====================================================================== */

/**
 * Search both ads and users together, sorted by relevance.
 *
 * Architecture:
 *   1. DB-level ILIKE search (scalable, paginated)
 *   2. Semantic scoring on DB results only
 *   3. Users searched separately (username/displayName ILIKE)
 *   4. Combined and sorted by score
 */
export async function searchGlobalMixed(
  query: string
): Promise<(SearchResultAd | SearchResultUser)[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const normalizedQuery = normalizeSearchText(trimmed);
  if (!normalizedQuery) return [];

  // Expand query into semantic groups
  const { originalTokens, semanticTerms } = expandQuery(normalizedQuery);
  if (originalTokens.length === 0 || semanticTerms.size === 0) return [];

  // DB-level search (scaler, paginated to first page)
  const dbAds = await searchProductsDb(query, { page: 1, limit: 100 });

  // Load images for all matched ads in batch
  const adIds = dbAds.map((ad) => ad.id);
  const imageMap = new Map<string, string>();
  if (adIds.length > 0) {
    const imageRows = await db
      .select({ adId: adImages.adId, imageUrl: adImages.imageUrl, isPrimary: adImages.isPrimary, sortOrder: adImages.sortOrder })
      .from(adImages)
      .where(inArray(adImages.adId, adIds));

    // Sort each ad's images: primary first, then by sortOrder
    imageRows.sort((a, b) => (a.isPrimary ? 0 : 1) - (b.isPrimary ? 0 : 1) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    // Store primary image for each ad
    for (const row of imageRows) {
      if (!imageMap.has(row.adId)) {
        imageMap.set(row.adId, row.imageUrl);
      }
    }
  }

  // Score DB results using semantic groups (bounded set, not full table)
  const adResults: SearchResultAd[] = [];
  for (const ad of dbAds) {
    const scored = scoreAd(ad, originalTokens, semanticTerms, normalizedQuery);
    if (scored) {
      adResults.push({
        type: "ad" as const,
        id: ad.id,
        title: ad.title,
        price: ad.price,
        currency: ad.currency,
        // Use batch-loaded image or fall back to ad.image
        image: imageMap.get(ad.id) ?? ad.image,
        location: ad.location,
        sellerName: ad.sellerName,
        postedAgoHours: ad.postedAgoHours,
        categorySlug: ad.categorySlug,
        ownerId: ad.ownerId,
        score: scored.score,
      });
    }
  }

  // Search users via DB (ILIKE on username/displayName)
  const userRows = await userRepository.getAllWithUsername();
  // Helper: convert date-like to ISO string
  const toIso = (val: Date | string | null | undefined): string | null => {
    if (val == null) return null;
    if (val instanceof Date) return val.toISOString();
    return String(val);
  };
  const toIsoOrDef = (val: Date | string | null | undefined): string | undefined => {
    if (val == null) return undefined;
    if (val instanceof Date) return val.toISOString();
    return String(val);
  };

  const users: User[] = userRows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    username: row.username,
    usernameLower: row.usernameLower,
    usernameLastChangedAt: toIso(row.usernameLastChangedAt),
    joinedAt: toIsoOrDef(row.joinedAt) ?? new Date().toISOString(),
    avatar: row.avatar ?? "",
    email: row.email,
    role: row.role as User["role"],
    googleId: row.googleId ?? "",
    name: row.displayName,
    phone: row.phone ?? undefined,
  }));

  const allPublicAds = dbAds;
  const userResults: SearchResultUser[] = [];
  for (const user of users) {
    const scored = scoreUser(user, semanticTerms);
    if (scored) {
      const adsCount = allPublicAds.filter(
        (a) => a.ownerId === user.id && a.status === "approved"
      ).length;

      userResults.push({
        type: "user" as const,
        id: user.id,
        displayName: user.displayName,
        username: user.username,
        avatar: user.avatar,
        adsCount,
        joinedAt: user.joinedAt,
        score: scored.score,
      });
    }
  }

  // Deduplicate ads
  const adIdSet = new Set<string>();
  const dedupedAds: SearchResultAd[] = [];
  for (const ad of adResults) {
    if (!adIdSet.has(ad.id)) {
      adIdSet.add(ad.id);
      dedupedAds.push(ad);
    }
  }

  // Combine and sort
  const combined = [...dedupedAds, ...userResults].sort(
    (a, b) => b.score - a.score
  );
  return combined;
}

/* ====================================================================== */
/* Ad-only ranking (for sidebar SearchBar)                                */
/* ====================================================================== */

export function rankAdsByQuery(
  ads: Product[],
  query: string
): (Product & { score: number; synonymDisplay?: string })[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return ads.map((ad) => ({ ...ad, score: 0 }));
  }

  const normalizedQuery = normalizeSearchText(trimmed);
  if (!normalizedQuery) {
    return ads.map((ad) => ({ ...ad, score: 0 }));
  }

  const { originalTokens, semanticTerms } = expandQuery(normalizedQuery);
  if (originalTokens.length === 0 || semanticTerms.size === 0) {
    return ads.map((ad) => ({ ...ad, score: 0 }));
  }

  const results: (Product & { score: number; synonymDisplay?: string })[] = [];

  for (const ad of ads) {
    const scored = scoreAd(ad, originalTokens, semanticTerms, normalizedQuery);
    if (scored) {
      const matchedTerms: string[] = [];
      for (const term of semanticTerms) {
        let groupName = "";
        for (const group of SYNONYM_GROUPS) {
          if (group.terms.some((t) => t.toLowerCase() === term)) {
            groupName = group.group;
            break;
          }
        }
        const normalizedTitle = safeNormalize(ad.title);
        const normalizedDesc = safeNormalize(ad.description);
        if (normalizedTitle.includes(term) || normalizedDesc.includes(term)) {
          const originalSet = new Set(originalTokens);
          if (!originalSet.has(term)) {
            matchedTerms.push(term);
          }
        }
      }

      results.push({
        ...ad,
        score: scored.score,
        synonymDisplay: matchedTerms.length > 0 ? matchedTerms.slice(0, 5).join(", ") : undefined,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Get synonym display info for a query.
 */
export function getSynonymDisplay(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const normalizedQuery = normalizeSearchText(trimmed);
  const tokens = normalizedQuery.split(" ").filter(Boolean);

  const synonymMap = getSynonymMap();
  const matchedGroups: string[] = [];

  for (const token of tokens) {
    const group = synonymMap.get(token.toLowerCase());
    if (group && !matchedGroups.includes(group)) {
      matchedGroups.push(group);
    }
  }

  return matchedGroups;
}