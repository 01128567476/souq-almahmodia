/**
 * Text search helpers shared by the marketplace and admin ad listings.
 *
 * Two concerns live here, both pure and side-effect free so they can be reused
 * and unit-tested independently of the repository:
 *   1. `normalizeSearchText` — fold text so queries match regardless of case,
 *      Arabic diacritics, or orthographic variants (alef/taa-marbuta forms).
 *   2. `scoreFields` — rank a set of weighted fields against query tokens using
 *      AND semantics (every token must match some field).
 */

/* ======================================================================== */
/* Normalization helpers                                                    */
/* ======================================================================== */

/** Tashkeel (harakat) + superscript alef, stripped before matching. */
const ARABIC_DIACRITICS = /[ً-ٰٟ]/g;
/** Tatweel (kashida) — decorative letter elongation, carries no meaning. */
const TATWEEL = /ـ/g;

/**
 * Normalize text for search matching.
 *
 * Lowercases (a no-op for Arabic), strips Arabic diacritics and tatweel, and
 * folds the letter variants that trip up naive substring search in Arabic:
 * the alef hamza forms, alef maqsura, taa marbuta, and hamza-on-seat letters.
 * This lets "احمد" match "أحمد" and "عبايه" match "عباية". Whitespace is
 * collapsed so multi-space queries behave.
 */
export function normalizeSearchText(input: string): string {
  return input
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(/[أإآٱ]/g, "ا") // أ إ آ ٱ -> ا (bare alef)
    .replace(/ى/g, "ي") // ى -> ي (alef maqsura -> yaa)
    .replace(/ة/g, "ه") // ة -> ه (taa marbuta -> haa)
    .replace(/ؤ/g, "و") // ؤ -> و (waw with hamza -> waw)
    .replace(/ئ/g, "ي") // ئ -> ي (yaa with hamza -> yaa)
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize a query and split it into search tokens (empty query -> []). */
export function tokenize(query: string): string[] {
  const normalized = normalizeSearchText(query);
  return normalized ? normalized.split(" ") : [];
}

/* ======================================================================== */
/* Field scoring (used by repositories)                                     */
/* ======================================================================== */

/** A single searchable field: pre-normalized text and its relevance weight. */
export interface SearchField {
  /** Field text, already passed through `normalizeSearchText`. */
  text: string;
  /** Relevance weight; heavier fields (e.g. title) rank matches higher. */
  weight: number;
}

/**
 * Score weighted fields against query tokens with AND semantics.
 *
 * Every token must appear in at least one field, otherwise the result is `0`
 * (no match). When all tokens match, the score is the sum of the heaviest
 * field each token hit, so a title hit outranks a description hit. An empty
 * token list scores `1` (an empty query matches everything, unranked).
 */
export function scoreFields(fields: SearchField[], tokens: string[]): number {
  if (tokens.length === 0) return 1;
  let score = 0;
  for (const token of tokens) {
    let best = 0;
    for (const field of fields) {
      if (field.text.includes(token)) best = Math.max(best, field.weight);
    }
    if (best === 0) return 0; // token matched nothing -> AND fails
    score += best;
  }
  return score;
}

/* ======================================================================== */
/* Client-side search with ranking and highlighting                         */
/* ======================================================================== */

/**
 * Check if text starts with the normalized token (after the token).
 * Supports Arabic word-boundary detection.
 */
function textStartsWith(text: string, token: string): boolean {
  // Match at start of string or after a word boundary
  const regex = new RegExp(`^${escapeRegex(token)}`);
  return regex.test(text);
}

/**
 * Check if text exactly equals the normalized token (case-insensitive, normalized).
 */
function textExactMatch(text: string, token: string): boolean {
  return text === token;
}

/** Escape special regex characters. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find the best matching score and type for a single token against normalized text.
 * Returns null if no match.
 */
function tokenMatchScore(normalizedText: string, normalizedToken: string): { score: number; type: "exact" | "startsWith" | "contains" } | null {
  if (!normalizedText || !normalizedToken) return null;
  
  if (textExactMatch(normalizedText, normalizedToken)) {
    return { score: 3, type: "exact" };
  }
  if (textStartsWith(normalizedText, normalizedToken)) {
    return { score: 2, type: "startsWith" };
  }
  if (normalizedText.includes(normalizedToken)) {
    return { score: 1, type: "contains" };
  }
  return null;
}

/**
 * Find all matches for tokens in text, for highlighting.
 * Returns an array of { start, end, matchedToken } for each highlight.
 */
export function findHighlights(text: string, tokens: string[]): Array<{ start: number; end: number; token: string }> {
  const highlights: Array<{ start: number; end: number; token: string }> = [];
  const normalizedText = normalizeSearchText(text);
  
  for (const rawToken of tokens) {
    const normalizedToken = normalizeSearchText(rawToken);
    if (!normalizedToken) continue;
    
    // Try to find in normalized text first
    let idx = normalizedText.indexOf(normalizedToken);
    while (idx !== -1) {
      // Map back to original text position approximately
      highlights.push({ start: idx, end: idx + normalizedToken.length, token: rawToken });
      idx = normalizedText.indexOf(normalizedToken, idx + 1);
    }
  }
  
  return highlights.sort((a, b) => a.start - b.start);
}

/**
 * Highlight matching text in a string.
 * Wraps matched portions in <mark> tags.
 */
export function highlightText(text: string, query: string): string {
  if (!query.trim()) return text;
  
  const tokens = tokenize(query);
  const normalizedText = normalizeSearchText(text);
  
  // Find all match positions in the original text
  const matches: Array<{ start: number; end: number; priority: number }> = [];
  
  for (const rawToken of tokens) {
    const normalizedToken = normalizeSearchText(rawToken);
    if (!normalizedToken) continue;
    
    // Find in original text (case-insensitive)
    const lowerText = text.toLowerCase();
    const lowerToken = normalizedToken.toLowerCase();
    
    let idx = lowerText.indexOf(lowerToken);
    while (idx !== -1) {
      // Calculate priority
      const excerpt = text.substring(idx, idx + rawToken.length);
      if (text.toLowerCase() === lowerToken) {
        matches.push({ start: idx, end: idx + rawToken.length, priority: 3 });
      } else if (lowerText.startsWith(lowerToken, idx) && (idx === 0 || !/[a-zA-Z\u0600-\u06FF\u0750-\u077F]/.test(text[idx - 1]))) {
        matches.push({ start: idx, end: idx + rawToken.length, priority: 2 });
      } else {
        matches.push({ start: idx, end: idx + rawToken.length, priority: 1 });
      }
      idx = lowerText.indexOf(lowerToken, idx + 1);
    }
  }
  
  if (matches.length === 0) return text;
  
  // Merge overlapping matches
  const sorted = matches.sort((a, b) => a.start - b.start || b.priority - a.priority);
  const merged: Array<{ start: number; end: number; priority: number }> = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
      last.priority = Math.max(last.priority, sorted[i].priority);
    } else {
      merged.push({ ...sorted[i] });
    }
  }
  
  // Build highlighted string
  let result = "";
  let lastEnd = 0;
  
  for (const match of merged) {
    result += text.substring(lastEnd, match.start);
    result += `<mark class="bg-primary/20 text-inherit rounded px-0.5">${text.substring(match.start, match.end)}</mark>`;
    lastEnd = match.end;
  }
  result += text.substring(lastEnd);
  
  return result;
}

/* ======================================================================== */
/* Product search result with ranking                                       */
/* ======================================================================== */

/** A product search result with its relevance score. */
export interface ProductSearchResult {
  product: import("@/types").Product;
  score: number;
  /** Breakdown of which fields matched. */
  matchedFields: string[];
}

/**
 * Search products with detailed ranking.
 * Returns products sorted by relevance with score breakdown.
 *
 * Ranking priority:
 * 1. Exact title match (highest)
 * 2. Title starts with query
 * 3. Title contains query
 * 4. Seller username/display name match
 * 5. Category match
 * 6. Description match
 */
export function searchProductsRanked(
  products: import("@/types").Product[],
  query: string,
  categoryNames: Map<string, string> = new Map(),
): ProductSearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return products.map((p) => ({ product: p, score: 0, matchedFields: [] }));
  }

  return products
    .map((product) => {
      const normalizedTitle = normalizeSearchText(product.title);
      const normalizedDescription = normalizeSearchText(product.description ?? "");
      const normalizedSeller = normalizeSearchText(product.sellerName);
      const normalizedSlug = normalizeSearchText(product.categorySlug);
      const normalizedLocation = normalizeSearchText(product.location);

      let score = 0;
      const matchedFields: string[] = [];
      let hasMatch = false;

      // --- Title matching (highest priority) ---
      for (const token of tokens) {
        const titleMatch = tokenMatchScore(normalizedTitle, token);
        if (titleMatch) {
          score += titleMatch.score * 10;
          matchedFields.push("title");
          hasMatch = true;
        }
      }

      // --- Seller name matching ---
      for (const token of tokens) {
        const sellerMatch = tokenMatchScore(normalizedSeller, token);
        if (sellerMatch) {
          score += sellerMatch.score * 5;
          if (!matchedFields.includes("seller")) {
            matchedFields.push("seller");
            hasMatch = true;
          }
        }
      }

      // --- Category matching ---
      for (const token of tokens) {
        if (normalizedSlug.includes(token)) {
          score += 3;
          if (!matchedFields.includes("category")) {
            matchedFields.push("category");
            hasMatch = true;
          }
        }
        const catName = categoryNames.get(product.categorySlug);
        if (catName && catName.includes(token)) {
          score += 3;
          if (!matchedFields.includes("category")) {
            matchedFields.push("category");
            hasMatch = true;
          }
        }
      }

      // --- Location matching ---
      for (const token of tokens) {
        if (normalizedLocation.includes(token)) {
          score += 2;
          if (!matchedFields.includes("location")) {
            matchedFields.push("location");
            hasMatch = true;
          }
        }
      }

      // --- Description matching (lowest priority) ---
      for (const token of tokens) {
        if (normalizedDescription.includes(token)) {
          score += 1;
          if (!matchedFields.includes("description")) {
            matchedFields.push("description");
            hasMatch = true;
          }
        }
      }

      return { product, score, matchedFields } as ProductSearchResult;
    })
    .filter((r) => tokens.length === 0 || r.score > 0)
    .sort((a, b) => b.score - a.score);
}