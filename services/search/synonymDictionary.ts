/**
 * Search Synonym Dictionary — Professional synonym engine for marketplace search.
 *
 * Architecture:
 *   Query → Normalize → Expand via Synonym Dictionary → Search Repository → Results
 *
 * Backend-ready:
 *   Today: Local dictionary (this file)
 *   Future: GET /api/search/synonyms → same interface, zero UI changes
 *
 * How it works:
 *   1. User types: "سيارة" or "Car" or "عربية"
 *   2. Dictionary expands to all synonym groups
 *   3. All expanded tokens are used for search
 *   4. Same results regardless of which synonym the user typed
 *
 * Supported languages:
 *   - Arabic (with full diacritic normalization)
 *   - English (case-insensitive)
 *   - Mixed Arabic/English
 */

import { normalizeSearchText } from "@/utils/search";

/** A single synonym group: all terms in this array are considered equivalent. */
export interface SynonymGroup {
  /** Canonical name for this synonym group (used for debugging). */
  group: string;
  /** All equivalent terms (already normalized: lowercase, no diacritics). */
  terms: string[];
}

/* ======================================================================== */
                                                          /* Synonym Groups */
/* ======================================================================== */

/** All synonym groups for the marketplace search engine. */
export const SYNONYM_GROUPS: SynonymGroup[] = [
  // =========================================================================
  // Vehicles
  // =========================================================================
  {
    group: "vehicles",
    terms: ["سيارة", "سيارات", "عربية", "عربيات", "مركبة", "مركبات", "عربيه", "car", "cars", "vehicle", "vehicles", "auto"],
  },

  // =========================================================================
  // Motorcycles
  // =========================================================================
  {
    group: "motorcycles",
    terms: [
      "موتوسيكل",
      "موتوسيكلات",
      "موتوسكليت",
      "دراجة",
      "دراجة نارية",
      "سكوتر",
      "bike",
      "motorcycle",
      "motorcycles",
      "scooter",
    ],
  },

  // =========================================================================
  // Phone
  // =========================================================================
  {
    group: "phone",
    terms: [
      "هاتف",
      "هاتف محمول",
      "موبايل",
      "جوال",
      "تليفون",
      "تلفون",
      "محمول",
      "phone",
      "mobile",
      "cellphone",
      "cellphones",
      "smartphone",
      "smartphones",
    ],
  },

  // =========================================================================
  // iPhone
  // =========================================================================
  {
    group: "iphone",
    terms: [
      "ايفون",
      "أيفون",
      "آيفون",
      "ايفون 15",
      "ايفون 16",
      "ايفون برو",
      "ايفون برو ماكس",
      "ايفونات",
      "iphone",
      "i phone",
      "i-phone",
      "iphonex",
      "apple phone",
      "apple phones",
    ],
  },

  // =========================================================================
  // Samsung
  // =========================================================================
  {
    group: "samsung",
    terms: ["سامسونج", "samsung", "galaxy", "جالكسي", "جالكسي", "جلكسي"],
  },

  // =========================================================================
  // Xiaomi
  // =========================================================================
  {
    group: "xiaomi",
    terms: ["شاومي", "xiaomi", "redmi", "ريدمي", "poco", "بوكو", "بوكو"],
  },

  // =========================================================================
  // Huawei
  // =========================================================================
  {
    group: "huawei",
    terms: ["هواوي", "huawei", "honor", "هونر", "هونر", "أنور"],
  },

  // =========================================================================
  // Laptop
  // =========================================================================
  {
    group: "laptop",
    terms: [
      "لاب",
      "لاب توب",
      "لاب توبات",
      "لابتوب",
      "notebook",
      "notebooks",
      "حاسوب محمول",
      "حاسوبات محمولة",
    ],
  },

  // =========================================================================
  // Computer
  // =========================================================================
  {
    group: "computer",
    terms: [
      "كمبيوتر",
      "كمبيوتر",
      "كمبيوتر",
      "كمبيوتر",
      "pc",
      "desktop",
      "desktops",
      "computer",
      "computers",
      "حاسوب",
      "حاسب",
      "حاسوبات",
    ],
  },

  // =========================================================================
  // Electronics
  // =========================================================================
  {
    group: "electronics",
    terms: [
      "الكترونيات",
      "إلكترونيات",
      "الكترونيات",
      "اجهزة",
      "أجهزة",
      "تقنية",
      "تكنولوجيا",
      "electronics",
      "devices",
      "device",
    ],
  },

  // =========================================================================
  // Television
  // =========================================================================
  {
    group: "television",
    terms: [
      "تلفزيون",
      "تليفزيون",
      "شاشة",
      "شاشه",
      "شاشات",
      "smart tv",
      "tv",
      "oled",
      "qled",
      "تلفاز",
      "تلفازات",
    ],
  },

  // =========================================================================
  // Air Conditioner
  // =========================================================================
  {
    group: "air_conditioner",
    terms: [
      "تكييف",
      "مكيف",
      "مكيفات",
      "ac",
      "air conditioner",
      "air conditioners",
      "شلتونة",
    ],
  },

  // =========================================================================
  // Refrigerator
  // =========================================================================
  {
    group: "refrigerator",
    terms: ["ثلاجة", "ثلاجه", "الثلاجة", "fridge", "refrigerator", "refrigerators", "فريزر"],
  },

  // =========================================================================
  // Washing Machine
  // =========================================================================
  {
    group: "washing_machine",
    terms: ["غسالة", "غساله", "غسيل", "washer", "washing machine", "washing machines"],
  },

  // =========================================================================
  // Furniture
  // =========================================================================
  {
    group: "furniture",
    terms: ["اثاث", "أثاث", "عفش", "مفروشات", "furniture"],
  },

  // =========================================================================
  // Living Room
  // =========================================================================
  {
    group: "living_room",
    terms: ["كنبة", "كنب", "صالون", "انتريه", "living room", "salon"],
  },

  // =========================================================================
  // Bedroom
  // =========================================================================
  {
    group: "bedroom",
    terms: [
      "غرفة نوم",
      "غرفه نوم",
      "سرير",
      "سراير",
      "دولاب",
      "كومود",
      "bedroom",
      "bed",
      "beds",
      "wardrobe",
      "wardrobes",
      "dresser",
    ],
  },

  // =========================================================================
  // Office
  // =========================================================================
  {
    group: "office",
    terms: [
      "مكتب",
      "مكاتب",
      "كرسي مكتب",
      "كراسي مكتب",
      "office desk",
      "office chair",
      "desk",
      "desks",
    ],
  },

  // =========================================================================
  // Clothing
  // =========================================================================
  {
    group: "clothing",
    terms: [
      "هدوم",
      "ملابس",
      "ازياء",
      "أزياء",
      "لبس",
      "لباس",
      "clothes",
      "fashion",
      "apparel",
    ],
  },

  // =========================================================================
  // Shirts
  // =========================================================================
  {
    group: "shirts",
    terms: [
      "تيشيرت",
      "تيشيرتات",
      "قميص",
      "قمصان",
      "شيرت",
      "shirt",
      "shirts",
      "t-shirt",
      "tshirt",
    ],
  },

  // =========================================================================
  // Pants
  // =========================================================================
  {
    group: "pants",
    terms: [
      "بنطلون",
      "بناطيل",
      "جينز",
      "blouse",
      "pants",
      "trousers",
    ],
  },

  // =========================================================================
  // Jackets
  // =========================================================================
  {
    group: "jackets",
    terms: [
      "جاكيت",
      "جاكيتات",
      "جاكيتات",
      "هودي",
      "هوديز",
      "معطف",
      "معاطف",
      "jacket",
      "jackets",
      "hoodie",
      "hoodies",
    ],
  },

  // =========================================================================
  // Shoes
  // =========================================================================
  {
    group: "shoes",
    terms: [
      "حذاء",
      "احذية",
      "أحذية",
      "جزمة",
      "جزم",
      "كوتشي",
      "كوتشات",
      "سنيكر",
      "سنيكرز",
      "shoes",
      "sneakers",
      "sneaker",
      "shoe",
      "boots",
    ],
  },

  // =========================================================================
  // Bags
  // =========================================================================
  {
    group: "bags",
    terms: [
      "شنطة",
      "شنط",
      "حقيبة",
      "حقائب",
      "bag",
      "bags",
      "backpack",
      "backpacks",
    ],
  },

  // =========================================================================
  // Watch
  // =========================================================================
  {
    group: "watch",
    terms: [
      "ساعة",
      "ساعات",
      "ساعة ذكية",
      "ساعه ذكيه",
      "smart watch",
      "smart watches",
      "watch",
      "watches",
    ],
  },

  // =========================================================================
  // Real Estate
  // =========================================================================
  {
    group: "real_estate",
    terms: [
      "عقار",
      "عقارات",
      "بيت",
      "منزل",
      "دار",
      "شقة",
      "شقق",
      "فيلا",
      "فلل",
      "دوبلكس",
      "بنتهاوس",
      "استوديو",
      "real estate",
      "property",
      "properties",
      "house",
      "houses",
      "apartment",
      "apartments",
      "villa",
      "villas",
    ],
  },

  // =========================================================================
  // Land
  // =========================================================================
  {
    group: "land",
    terms: ["ارض", "أرض", "قطعة ارض", "قطعه ارض", "land", "lands", "plot", "plots"],
  },

  // =========================================================================
  // Pets
  // =========================================================================
  {
    group: "pets",
    terms: [
      "حيوان",
      "حيوانات",
      "قط",
      "قطة",
      "قطط",
      "كلب",
      "كلاب",
      "عصافير",
      "طيور",
      "pets",
      "bird",
      "birds",
      "cat",
      "cats",
      "dog",
      "dogs",
      "pet",
    ],
  },

  // =========================================================================
  // Kids
  // =========================================================================
  {
    group: "kids",
    terms: [
      "اطفال",
      "أطفال",
      "بيبي",
      "رضيع",
      "رضع",
      "baby",
      "babies",
      "kids",
      "child",
      "children",
    ],
  },

  // =========================================================================
  // Books
  // =========================================================================
  {
    group: "books",
    terms: [
      "كتاب",
      "كتب",
      "رواية",
      "روايات",
      "book",
      "books",
      "novel",
      "novels",
    ],
  },

  // =========================================================================
  // Sports
  // =========================================================================
  {
    group: "sports",
    terms: [
      "رياضة",
      "رياضه",
      "جيم",
      "جيمس",
      "fitness",
      "معدات رياضية",
      "معدات رياضيه",
      "sports",
      "sport",
      "gym",
    ],
  },

  // =========================================================================
  // Camera
  // =========================================================================
  {
    group: "camera",
    terms: [
      "كاميرا",
      "كاميرات",
      "كامره",
      "كامرات",
      "camera",
      "cameras",
      "photo",
      "photography",
    ],
  },

  // =========================================================================
  // Gaming
  // =========================================================================
  {
    group: "gaming",
    terms: [
      "جيمر",
      "جيمينج",
      "بلايستيشن",
      "بلاي ستيشن",
      "اكس بوكس",
      "نينتندو",
      "gaming",
      "playstation",
      "xbox",
      "nintendo",
      "gamers",
    ],
  },

  // =========================================================================
  // Home Appliances
  // =========================================================================
  {
    group: "home_appliances",
    terms: [
      "أجهزة منزلية",
      "اجهزه منزلية",
      "أجهزة",
      "home appliance",
      "home appliances",
    ],
  },
];

/* ======================================================================== */
/* Synonym Map Builder                                                      */
/* ======================================================================== */

/**
 * Build a map from each term to its synonym group.
 * Example: "سيارة" → "vehicles" group
 *          "car" → "vehicles" group
 * @returns A map where each synonym term maps to its group name.
 */
export function buildSynonymMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of SYNONYM_GROUPS) {
    for (const term of group.terms) {
      const normalizedTerm = term.toLowerCase().trim();
      if (normalizedTerm) {
        map.set(normalizedTerm, group.group);
      }
    }
  }
  return map;
}

/** Global singleton synonym map. */
let _synonymMap: Map<string, string> | null = null;

/**
 * Get the global synonym map (singleton).
 * @returns The synonym map.
 */
export function getSynonymMap(): Map<string, string> {
  if (!_synonymMap) {
    _synonymMap = buildSynonymMap();
  }
  return _synonymMap;
}

/* ======================================================================== */
/* Query Expansion                                                          */
/* ======================================================================== */

/**
 * Expand a normalized query using the synonym dictionary.
 *
 * For each token in the query, finds all synonyms and returns
 * all unique tokens that should be searched.
 *
 * Example:
 *   Input: "سيارة"
 *   Output: ["سيارة", "سيارات", "عربية", "عربيات", "مركبة", "مركبات", ...]
 *
 * @param normalizedQuery - Already normalized query string.
 * @returns Array of all expanded search tokens (unique, sorted by relevance).
 */
export function expandQueryWithSynonyms(normalizedQuery: string): string[] {
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  if (tokens.length === 0) return [];

  const synonymMap = getSynonymMap();
  const expandedTokens = new Set<string>();
  const groupFrequency = new Map<string, number>();

  for (const token of tokens) {
    const lowerToken = token.toLowerCase();

    // Check if token has synonyms
    const group = synonymMap.get(lowerToken);

    if (group) {
      // Find the group and add all its terms
      const synonymGroup = SYNONYM_GROUPS.find((g) => g.group === group);
      if (synonymGroup) {
        for (const term of synonymGroup.terms) {
          expandedTokens.add(term.toLowerCase());
          groupFrequency.set(term.toLowerCase(), (groupFrequency.get(term.toLowerCase()) ?? 0) + 1);
        }
      }
    } else {
      // No synonyms, just add the token itself
      expandedTokens.add(lowerToken);
    }
  }

  // Sort by frequency (most common first) for better ranking
  return Array.from(expandedTokens).sort((a, b) => {
    const freqA = groupFrequency.get(a) ?? 0;
    const freqB = groupFrequency.get(b) ?? 0;
    if (freqA !== freqB) return freqB - freqA;
    return a.length - b.length; // Longer terms first (more specific)
  });
}

/* ======================================================================== */
/* Public API                                                               */
/* ======================================================================== */

/**
 * Get all synonym groups.
 * @returns Array of all synonym groups.
 */
export function getAllSynonymGroups(): SynonymGroup[] {
  return SYNONYM_GROUPS;
}

/**
 * Get the total number of synonym terms.
 * @returns Total number of terms across all groups.
 */
export function getTotalSynonymCount(): number {
  return SYNONYM_GROUPS.reduce((sum, group) => sum + group.terms.length, 0);
}

/**
 * Get the number of synonym groups.
 * @returns Number of synonym groups.
 */
export function getSynonymGroupCount(): number {
  return SYNONYM_GROUPS.length;
}

/**
 * Get expanded tokens for a query (without normalization).
 * This is a convenience function that normalizes first, then expands.
 *
 * @param query - Raw user input.
 * @returns Array of expanded search tokens.
 */
export function getExpandedTokens(query: string): string[] {
  const normalized = normalizeSearchText(query);
  return expandQueryWithSynonyms(normalized);
}
