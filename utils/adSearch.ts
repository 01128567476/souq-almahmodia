/**
 * Pure ad search ranking utilities.
 *
 * This file contains NO database imports. It can be safely used in Client Components.
 * The search algorithm uses the same scoring constants and matching logic as
 * searchRepository.ts but works on in-memory Product arrays.
 */

import { normalizeSearchText, tokenize } from "@/utils/search";
import { SYNONYM_GROUPS, getSynonymMap } from "@/services/search/synonymDictionary";
import type { Product } from "@/types";

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
/* Query expansion                                                        */
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
/* Matching helpers                                                         */
/* ====================================================================== */

type MatchType = "none" | "exact" | "startsWith" | "contains";

function safeNormalize(text: string | undefined | null): string {
  return normalizeSearchText(text ?? "");
}

function getMatchType(
  normalizedField: string,
  token: string
): MatchType {
  if (normalizedField === token) return "exact";
  if (normalizedField.startsWith(token)) return "startsWith";
  if (normalizedField.includes(token)) return "contains";
  return "none";
}

/* ====================================================================== */
/* Ad scoring                                                             */
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
    const hasSynonym = Array.from(semanticTerms).some(
      (t) => !originalSet.has(t)
    );
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
/* Public API                                                             */
/* ====================================================================== */

/**
 * Rank ads by query — returns ads with scores, sorted descending.
 * Pure function, no database imports. Safe for Client Components.
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