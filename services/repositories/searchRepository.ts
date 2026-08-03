/**
 * Global Search Repository — professional marketplace search.
 *
 * Architecture:
 *       UI (SearchBar / SearchView)
 *       ↓
 *   SearchRepository (this file)
 *       ↓
 *   Mock Data (MOCK_USERS + adRepository.listPublic())
 *       ↓
 *   (Future) REST API → Express + MongoDB
 *
 * Synonym Engine Integration:
 *   Query → Normalize → Expand via Synonym Dictionary → Semantic Groups → Rank → Results
 *
 * Backend-ready: replace `searchGlobalMixed` with API calls without touching UI.
 *
 * ======================================================================
 * SEARCH ALGORITHM
 * ======================================================================
 *
 * 1. Normalize query (strip diacritics, normalize alef/taa-marbuta)
 * 2. Tokenize (split into words)
 * 3. Expand via synonymDictionary.ts — build semantic groups
 *    Each synonym group is ONE semantic unit:
 *    If ANY member of the group matches, the group is considered matched.
 * 4. For each ad, score by MATCH TYPE:
 *    - Exact query token match (highest priority)
 *    - Exact title match
 *    - Title starts with token
 *    - Multiple token matches from same group
 *    - Description match
 *    - Category match
 *    - Location match
 *    - Synonym match (lowest priority within matched group)
 * 5. Sort by total relevance score DESC
 *
 * IMPORTANT: No hardcoded words. Everything derived from:
 *   - The user's query tokens
 *   - The synonym dictionary (services/search/synonymDictionary.ts)
 *   - The ad fields (title, description, category, location, seller)
 *
 * Pinning has ZERO influence on search results.
 */

import type { Product, User, SearchResultAd, SearchResultUser } from "@/types";
import { adRepository } from "@/services/repositories/adRepository";
import { userRepository } from "@/services/repositories/userRepository";
import { normalizeSearchText } from "@/utils/search";
import { SYNONYM_GROUPS, getSynonymMap } from "@/services/search/synonymDictionary";


/* ====================================================================== */
/* Scoring constants (tune here to reshape ranking)                       */
/* ====================================================================== */

const SCORE = {
  // --- EXACT PHRASE MATCH (highest priority — must come first) ---
  // If the entire normalized query exists as a contiguous phrase in the title
  exactPhraseInTitle: 50, // Full query phrase found in title (e.g., "ايفون 15 برو" in "ايفون 15 برو ماكس")
  exactPhraseInField: 30, // Full query phrase found in other fields

  // --- Match type bonuses (added on top of field weight) ---
  exactQueryMatch: 20, // The ad field EXACTLY equals the query token
  exactTitleMatch: 15, // The ad title EXACTLY equals the query token
  titleStartsWith: 10, // The ad title starts with the query token
  multipleTokensInTitle: 8, // Multiple query tokens found in the title
  descriptionMatch: 2, // Found in description
  categoryMatch: 4, // Found in category slug/name
  locationMatch: 3, // Found in location
  sellerMatch: 3, // Found in seller name

  // --- Field base weights ---
  titleBase: 10,
  descriptionBase: 2,
  categoryBase: 4,
  locationBase: 3,
  sellerBase: 3,

  // --- Synonym bonus: when a synonym (not original query token) matches ---
  synonymMatch: 1,
} as const;

/* ====================================================================== */
/* Expand query tokens using synonymDictionary.ts (single source of truth) */
/* ====================================================================== */

/**
 * Expand query tokens into semantic groups.
 *
 * For each query token, find its synonym group.
 * All tokens from all synonym groups are merged into one set of search terms.
 * The original query tokens are tracked separately for ranking priority.
 *
 * Example:
 *   Query: "سيارة"
 *   Original tokens: ["سيارة"]
 *   Semantic terms: ["سيارة", "سيارات", "عربية", "عربيات", "car", "cars", "vehicle", ...]
 *
 * @returns { originalTokens, semanticTerms }
 */
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
/* Helper: normalize and tokenize a single text value                     */
/* ====================================================================== */

function safeNormalize(text: string | undefined | null): string {
  return normalizeSearchText(text ?? "");
}

/* ====================================================================== */
/* Advertisement matching                                                 */
/* ====================================================================== */

/**
 * Check if a token exists in the ad field.
 * Returns match type for ranking priority.
 */
type MatchType = "none" | "exact" | "startsWith" | "contains";

function getMatchType(
  normalizedField: string,
  token: string
): MatchType {
  if (normalizedField === token) return "exact";
  if (normalizedField.startsWith(token)) return "startsWith";
  if (normalizedField.includes(token)) return "contains";
  return "none";
}

/**
 * Score a single ad against expanded semantic groups.
 *
 * SEMANTIC MATCHING:
 * - All tokens from the same synonym group are treated as ONE semantic unit.
 * - If ANY member of the group matches ANY ad field, the ad qualifies.
 * - Ranking is based on the BEST match type and field weight.
 *
 * DEDUPICATION:
 * - semanticTerms is already a Set (no duplicate terms)
 * - Each field scores each semantic term at most once
 * - A term contributing to title cannot also score in description
 *
 * PHRASE MATCH:
 * - If the entire normalized query exists as a contiguous phrase in the title,
 *   it receives the highest possible score (exactPhraseInTitle).
 *
 * Returns { score, matchedFields } or null if no semantic group matches.
 */
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

  // Track which semantic groups matched and how well
  type GroupMatch = {
    groupName: string;
    bestMatchType: MatchType;
    bestFieldWeight: number;
  };
  const groupMatches: GroupMatch[] = [];

  // Track which terms have been scored per field — prevents duplicate scoring
  const scoredTitleTerms = new Set<string>();
  const scoredDescTerms = new Set<string>();
  const scoredCatTerms = new Set<string>();
  const scoredLocTerms = new Set<string>();
  const scoredSellerTerms = new Set<string>();

  // === PHRASE MATCH CHECK (highest priority — evaluated once per ad) ===
  let phraseMatchBonus = 0;
  if (normalizedQuery.length > 0 && normalizedTitle.includes(normalizedQuery)) {
    // The query is a contiguous phrase inside the title
    // e.g., query="ايفون 15 برو" title="ايفون 15 برو ماكس"
    phraseMatchBonus = SCORE.exactPhraseInTitle;
    if (!matchedFields.includes("title")) matchedFields.push("title");
    hasAnyMatch = true;
  }

  // === FIELD-LEVEL PHRASE MATCH (only if no title phrase match yet) ===
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

  // For each semantic term (already deduplicated by Set), check all ad fields
  for (const term of semanticTerms) {
    // Check which original group this term belongs to
    let groupName = "";
    for (const group of SYNONYM_GROUPS) {
      if (group.terms.some((t) => t.toLowerCase() === term)) {
        groupName = group.group;
        break;
      }
    }

    // Check title — only if this term hasn't been scored in title yet
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
          groupMatches.push({
            groupName,
            bestMatchType: titleMatch,
            bestFieldWeight: fieldWeight + matchBonus,
          });
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

    // Check description — only if this term hasn't been scored in description yet
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
          groupMatches.push({
            groupName,
            bestMatchType: descMatch,
            bestFieldWeight: fieldWeight + matchBonus,
          });
        }
        if (!matchedFields.includes("description")) matchedFields.push("description");
      }
    }

    // Check category — only if this term hasn't been scored in category yet
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
          groupMatches.push({
            groupName,
            bestMatchType: catMatch,
            bestFieldWeight: fieldWeight + matchBonus,
          });
        }
        if (!matchedFields.includes("category")) matchedFields.push("category");
      }
    }

    // Check location — only if this term hasn't been scored in location yet
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
          groupMatches.push({
            groupName,
            bestMatchType: locMatch,
            bestFieldWeight: fieldWeight + matchBonus,
          });
        }
        if (!matchedFields.includes("location")) matchedFields.push("location");
      }
    }

    // Check seller — only if this term hasn't been scored in seller yet
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
          groupMatches.push({
            groupName,
            bestMatchType: sellerMatch,
            bestFieldWeight: fieldWeight + matchBonus,
          });
        }
        if (!matchedFields.includes("seller")) matchedFields.push("seller");
      }
    }
  }

  // No semantic group matched — exclude this ad
  if (!hasAnyMatch || groupMatches.length === 0) return null;

  // Check if any term is a synonym (not an original query token)
  const originalSet = new Set(originalTokens);

  // Calculate total score from group matches
  for (const gm of groupMatches) {
    // Determine if this group had synonym matches or exact matches
    const hasSynonym = Array.from(semanticTerms).some(
      (t) => !originalSet.has(t)
    );

    if (hasSynonym && gm.bestMatchType === "contains") {
      // Synonym match with lowest bonus
      totalScore += SCORE.synonymMatch;
    }

    totalScore += gm.bestFieldWeight;
  }

  // Add phrase match bonuses (highest priority scoring)
  totalScore += phraseMatchBonus;
  totalScore += fieldPhraseMatchBonus;

  // Bonus: multiple original tokens matched
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
/* User matching                                                          */
/* ====================================================================== */

function getMatchTypeUser(
  normalizedField: string,
  token: string
): MatchType {
  if (normalizedField === token) return "exact";
  if (normalizedField.startsWith(token)) return "startsWith";
  if (normalizedField.includes(token)) return "contains";
  return "none";
}

/**
 * Score a single user against query tokens.
 */
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
    const usernameMatch = getMatchTypeUser(normalizedUsername, token);
    const displayNameMatch = getMatchTypeUser(normalizedDisplayName, token);

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
 * Algorithm:
 *   1. Normalize query
 *   2. Expand via synonym dictionary → semantic groups
 *   3. For each ad: score by match type and field weight
 *   4. For each user: score by username/displayName match
 *   5. Combine and sort by score DESC
 *
 * Ranking priority:
 *   1. Exact query token match in title (20 + 10 = 30)
 *   2. Exact title match (15 + 10 = 25)
 *   3. Title starts with token (10 + 10 = 20)
 *   4. Multiple token matches (8 × N)
 *   5. Category exact match (4 + 4 = 8)
 *   6. Location match (3 + 3 = 6)
 *   7. Seller match (3 + 3 = 6)
 *   8. Description match (2 + 2 = 4)
 *   9. Synonym match bonus (1)
 *
 * @param query - raw user input
 * @returns sorted array of SearchResult (ads + users)
 */
export async function searchGlobalMixed(
  query: string
): Promise<(SearchResultAd | SearchResultUser)[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Step 1: Normalize the query
  const normalizedQuery = normalizeSearchText(trimmed);
  if (!normalizedQuery) return [];

  // Step 2: Expand query into semantic groups
  const { originalTokens, semanticTerms } = expandQuery(normalizedQuery);
  if (originalTokens.length === 0 || semanticTerms.size === 0) return [];

  // Step 3: Fetch all data
  const ads = await adRepository.listPublic();
  const userRows = await userRepository.getAllWithUsername();
  // Map DB rows to User type for scoreUser
  const users: User[] = userRows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    username: row.username,
    usernameLower: row.usernameLower,
    usernameLastChangedAt: row.usernameLastChangedAt?.toISOString() ?? null,
    joinedAt: row.joinedAt.toISOString(),
    avatar: row.avatar ?? "",
    email: row.email,
    role: row.role as User["role"],
    googleId: row.googleId ?? "",
    name: row.displayName,
    phone: row.phone ?? undefined,
  }));
  const allPublicAds = ads;

  // Step 4: Score ads using semantic groups
  const adResults: SearchResultAd[] = [];
  for (const ad of ads) {
    const scored = scoreAd(ad, originalTokens, semanticTerms, normalizedQuery);
    if (scored) {
      adResults.push({
        type: "ad" as const,
        id: ad.id,
        title: ad.title,
        price: ad.price,
        currency: ad.currency,
        image: ad.image,
        location: ad.location,
        sellerName: ad.sellerName,
        postedAgoHours: ad.postedAgoHours,
        categorySlug: ad.categorySlug,
        ownerId: ad.ownerId,
        score: scored.score,
      });
    }
  }

  // Step 5: Score users using semantic groups
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

  // Step 6: Deduplicate ads by ad.id
  const adIdSet = new Set<string>();
  const dedupedAds: SearchResultAd[] = [];
  for (const ad of adResults) {
    if (!adIdSet.has(ad.id)) {
      adIdSet.add(ad.id);
      dedupedAds.push(ad);
    }
  }

  // Step 7: Combine and sort by score descending
  const combined = [...dedupedAds, ...userResults].sort(
    (a, b) => b.score - a.score
  );
  return combined;
}

/* ====================================================================== */
/* Ad-only search (for sidebar SearchBar)                                 */
/* ====================================================================== */

/**
 * Rank ads by query — returns ads with scores, sorted descending.
 * Uses the same semantic search engine as searchGlobalMixed.
 * This is the SINGLE SOURCE OF TRUTH for ad ranking.
 *
 * @param ads - Array of ads to search (typically from adRepository.listPublic())
 * @param query - Raw user input
 * @returns Array of ads with added `score` property, sorted by score DESC
 */
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
      // Build synonym display for UI: show matched synonym groups
      const matchedTerms: string[] = [];
      for (const term of semanticTerms) {
        let groupName = "";
        for (const group of SYNONYM_GROUPS) {
          if (group.terms.some((t) => t.toLowerCase() === term)) {
            groupName = group.group;
            break;
          }
        }
        // Check if this term actually matched the ad
        const normalizedTitle = safeNormalize(ad.title);
        const normalizedDesc = safeNormalize(ad.description);
        if (normalizedTitle.includes(term) || normalizedDesc.includes(term)) {
          // Only add non-original tokens as "synonyms"
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

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Get synonym display info for a query.
 * Returns the synonym groups that match words in the query.
 * Used by UI to display "showing results for X (including synonyms)".
 *
 * @param query - Raw user input
 * @returns Array of matched synonym group names
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
