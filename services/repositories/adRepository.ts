/**
 * Advertisement repository — Drizzle ORM implementation.
 *
 * Replaces mockDb with PostgreSQL via Drizzle ORM.
 *
 * Public interface remains EXACTLY the same.
 */

import type { AdStatus, Product } from "@/types";
import { PUBLIC_AD_STATUSES } from "@/types";
import { db } from "@/lib/db-server";
import { products, categories, notifications, moderationEvents, adImages } from "@/drizzle/schema";
import { eq, and, or, ilike, not, sql, inArray } from "drizzle-orm";
import { clone } from "@/lib/db-utils";
import { recordAdModeration, type RecordInput } from "@/services/repositories/auditRepository";
import { notificationRepository } from "@/services/repositories/notificationRepository";
import { normalizeSearchText, tokenize, scoreFields, type SearchField } from "@/utils/search";
import { validateTransition, applyTransition, type TransitionError } from "@/services/adStateMachine";

/* ======================================================================== */
/* Helpers                                                                  */
/* ======================================================================== */

/**
 * Batch load images from ad_images table for multiple products.
 * Uses ONE query with WHERE ad_id IN (...) instead of N+1 queries.
 *
 * Returns: Map<adId, { primary: string | null, images: string[] }>
 */
async function loadImagesBatch(productIds: string[]): Promise<Map<string, { primary: string | null; images: string[] }>> {
  const imageMap = new Map<string, { primary: string | null; images: string[] }>();

  if (productIds.length === 0) return imageMap;

  // ONE query for ALL products
  const rows = await db
    .select()
    .from(adImages)
    .where(inArray(adImages.adId, productIds))
    .orderBy(
      sql`${adImages.isPrimary} DESC`,
      sql`${adImages.sortOrder} ASC`
    );

  // Group by ad_id
  const grouped = new Map<string, typeof adImages.$inferSelect[]>();
  for (const row of rows) {
    const existing = grouped.get(row.adId) ?? [];
    existing.push(row);
    grouped.set(row.adId, existing);
  }

  // Build result map
  for (const productId of productIds) {
    const images = grouped.get(productId) ?? [];
    if (images.length === 0) {
      imageMap.set(productId, { primary: null, images: [] });
    } else {
      const primaryImage = images.find((r) => r.isPrimary)?.imageUrl ?? images[0].imageUrl;
      imageMap.set(productId, {
        primary: primaryImage ?? null,
        images: images.map((r) => r.imageUrl),
      });
    }
  }

  return imageMap;
}

/**
 * Map images to a single product from the batch result.
 * Derives `image` from images[0] so UI always has a primary image URL when images exist.
 */
function applyImagesToProduct(product: Product, imageData: { primary: string | null; images: string[] }): Product {
  return {
    ...product,
    image: imageData.images?.[0] ?? "",
    images: imageData.images,
  };
}

/**
 * Load images for a single product (used for getById and mutations).
 */
async function mapImagesToProduct(productId: string, product: Product): Promise<Product> {
  const imageMap = await loadImagesBatch([productId]);
  const imageData = imageMap.get(productId);
  if (!imageData || imageData.images.length === 0) {
    return { ...product, image: "", images: [] };
  }
  return applyImagesToProduct(product, imageData);
}

function isExpired(ad: Product): boolean {
  if (!ad.expiresAt) return false;
  return new Date(ad.expiresAt).getTime() <= Date.now();
}

function isPublicApproved(ad: Product): boolean {
  return ad.status === "approved";
}

/** An ad is publicly visible when it is in a public status AND not expired. */
function isPubliclyVisible(ad: Product): boolean {
  if (!PUBLIC_AD_STATUSES.includes(ad.status)) return false;
  if (ad.expiresAt && new Date(ad.expiresAt).getTime() < Date.now()) return false;
  return true;
}

/** Sort: pinned → pinnedAt DESC → createdAt DESC. */
function pinnedSort(a: Product, b: Product): number {
  const aPinned = a.pinned === true ? 1 : 0;
  const bPinned = b.pinned === true ? 1 : 0;

  if (aPinned !== bPinned) return bPinned - aPinned;

  if (aPinned === 1) {
    const aPinnedAt = a.pinnedAt ?? "";
    const bPinnedAt = b.pinnedAt ?? "";
    if (aPinnedAt !== bPinnedAt) return bPinnedAt.localeCompare(aPinnedAt);
  }

  return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
}

function publicSort(a: Product, b: Product): number {
  return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
}

/* ======================================================================== */
/* Search helpers                                                           */
/* ======================================================================== */

const SEARCH_WEIGHTS = {
  title: 10,
  category: 6,
  location: 5,
  seller: 4,
  description: 2,
  phone: 3,
} as const;

function adSearchFields(
  ad: Product,
  categoryNames: Map<string, string>,
  includePhone: boolean,
): SearchField[] {
  const fields: SearchField[] = [
    { text: normalizeSearchText(ad.title), weight: SEARCH_WEIGHTS.title },
    {
      text: categoryNames.get(ad.categorySlug) ?? normalizeSearchText(ad.categorySlug),
      weight: SEARCH_WEIGHTS.category,
    },
    { text: normalizeSearchText(ad.location), weight: SEARCH_WEIGHTS.location },
    { text: normalizeSearchText(ad.sellerName), weight: SEARCH_WEIGHTS.seller },
    { text: normalizeSearchText(ad.description ?? ""), weight: SEARCH_WEIGHTS.description },
  ];
  if (includePhone) {
    fields.push({ text: normalizeSearchText(ad.sellerPhone), weight: SEARCH_WEIGHTS.phone });
  }
  return fields;
}

function searchAndRank(ads: Product[], query: string, includePhone: boolean): Product[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return ads.slice();

  const categoryNames = categoryNamesBySlug(ads);

  return ads
    .map((ad) => ({
      ad,
      score: scoreFields(adSearchFields(ad, categoryNames, includePhone), tokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.ad);
}

/** Build a category name map from a list of products. */
function categoryNamesBySlug(ads: Product[]): Map<string, string> {
  const slugSet = new Set<string>();
  for (const ad of ads) slugSet.add(ad.categorySlug);
  // We also need all categories — fetched via DB query
  return new Map(); // populated by DB query below
}

/* ======================================================================== */
/* Types                                                                    */
/* ======================================================================== */

export interface AdListFilter {
  statuses?: AdStatus[];
  search?: string;
  categorySlug?: string;
  ownerId?: string;
}

export type AdCreateInput = Omit<
  Product,
  "id" | "status" | "createdAt" | "updatedAt" | "featured" | "pinned" | "pinnedAt"
>;

export type AdUpdateInput = Partial<
  Pick<
    Product,
    | "title"
    | "description"
    | "price"
    | "currency"
    | "categorySlug"
    | "condition"
    | "location"
    | "sellerPhone"
    | "images"
    | "image"
    | "adminNotes"
    | "rejectionReason"
  >
>;

export interface Actor {
  id: string;
  name: string;
}

/* ======================================================================== */
/* Repository                                                               */
/* ======================================================================== */

export const adRepository = {
  /* ---------------------------------------------------------------------- */
  /* Public reads (marketplace)                                             */
  /* ---------------------------------------------------------------------- */

  /** Approved, non-expired ads for the public marketplace feed — pinned first. */
  async listPublic(): Promise<Product[]> {
    const rows = await db
      .select()
      .from(products)
      .where(
        and(
          sql`${products.status} IN ('approved')`,
          or(
            sql`${products.expiresAt} IS NULL`,
            sql`${products.expiresAt} > NOW()`
          )
        )
      )
      .orderBy(
        sql`${products.pinned} DESC, ${products.pinnedAt} DESC, ${products.createdAt} DESC`
      );

    const baseAds = rows.map(mapRowToProduct);
    const ads = await Promise.all(baseAds.map((ad) => mapImagesToProduct(ad.id, ad)));

    // Debug: verify images are loaded (show first 3 ads as sample)
    const sample = ads.slice(0, 3);
    for (const ad of sample) {
      const imgCount = ad.images?.length ?? 0;
      console.log(`[ADS] Ad ${ad.id}:`, {
        title: ad.title,
        image: ad.image,
        images: ad.images,
        imageCount: imgCount,
        hasImage: !!ad.image,
        hasImages: imgCount > 0,
        imagesMatchImage: ad.image === ad.images?.[0],
      });
    }
    console.log(`[ADS] Total public ads: ${ads.length}`);

    return clone(ads);
  },

  /** Public ads in a category — pinned first. */
  async listPublicByCategory(categorySlug: string): Promise<Product[]> {
    const rows = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.categorySlug, categorySlug),
          sql`${products.status} = 'approved'`,
          or(
            sql`${products.expiresAt} IS NULL`,
            sql`${products.expiresAt} > NOW()`
          )
        )
      )
      .orderBy(
        sql`${products.pinned} DESC, ${products.pinnedAt} DESC, ${products.createdAt} DESC`
      );

    const baseAds = rows.map(mapRowToProduct);
    const ads = await Promise.all(baseAds.map((ad) => mapImagesToProduct(ad.id, ad)));
    return clone(ads);
  },

  /** Search public ads — pure relevance ordering. */
  async searchPublic(query: string): Promise<Product[]> {
    const rows = await db
      .select()
      .from(products)
      .where(
        and(
          sql`${products.status} = 'approved'`,
          or(
            sql`${products.expiresAt} IS NULL`,
            sql`${products.expiresAt} > NOW()`
          )
        )
      );

    const baseAds = rows.map(mapRowToProduct);
    const ads = await Promise.all(baseAds.map((ad) => mapImagesToProduct(ad.id, ad)));
    return clone(searchAndRank(ads, query, false));
  },

  /** A single ad by id. */
  async getById(id: string): Promise<Product | null> {
    const rows = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (rows.length === 0) return null;

    const baseAd = mapRowToProduct(rows[0]);
    const ad = await mapImagesToProduct(baseAd.id, baseAd);
    return clone(ad);
  },

  /* ---------------------------------------------------------------------- */
  /* Owner reads (My Ads)                                                   */
  /* ---------------------------------------------------------------------- */

  /** Every ad owned by a user, excluding deleted. */
  async listByOwner(ownerId: string): Promise<Product[]> {
    const rows = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.ownerId, ownerId),
          sql`${products.status} != 'deleted'`
        )
      )
      .orderBy(sql`${products.createdAt} DESC`);

    const baseAds = rows.map(mapRowToProduct);
    const ads = await Promise.all(baseAds.map((ad) => mapImagesToProduct(ad.id, ad)));
    return clone(ads);
  },

  /* ---------------------------------------------------------------------- */
  /* Admin reads                                                            */
  /* ---------------------------------------------------------------------- */

  /** Admin listing with optional filters. */
  async list(filter: AdListFilter = {}): Promise<Product[]> {
    const conditions: any[] = [];

    if (filter.statuses && filter.statuses.length > 0) {
      conditions.push(sql`${products.status} IN (${filter.statuses.join(",")})`);
    } else {
      conditions.push(sql`${products.status} != 'deleted'`);
    }

    if (filter.categorySlug) {
      conditions.push(eq(products.categorySlug, filter.categorySlug));
    }

    if (filter.ownerId) {
      conditions.push(eq(products.ownerId, filter.ownerId));
    }

    const rows = await db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(sql`${products.createdAt} DESC`);

    const baseAds = rows.map(mapRowToProduct);
    const ads = await Promise.all(baseAds.map((ad) => mapImagesToProduct(ad.id, ad)));

    // Apply search filter in-memory (uses existing search logic)
    if (filter.search) {
      const categoryNames = await getCategoryNameMap();
      const tokens = tokenize(filter.search);
      return clone(
        ads.filter((a) =>
          scoreFields(adSearchFields(a, categoryNames, true), tokens) > 0
        )
      );
    }

    return clone(ads);
  },

  /** Ads awaiting review. */
  async listPending(): Promise<Product[]> {
    const rows = await db
      .select()
      .from(products)
      .where(eq(products.status, "pending"))
      .orderBy(sql`${products.createdAt} DESC`);

    const baseAds = rows.map(mapRowToProduct);
    const ads = await Promise.all(baseAds.map((ad) => mapImagesToProduct(ad.id, ad)));
    return clone(ads);
  },

  /** Reported ads queue. */
  async listReported(): Promise<Product[]> {
    const rows = await db
      .select({
        id: products.id,
        title: products.title,
        categorySlug: products.categorySlug,
        price: products.price,
        currency: products.currency,
        condition: products.condition,
        location: products.location,
        sellerName: products.sellerName,
        sellerPhone: products.sellerPhone,
        description: products.description,
        status: products.status,
        ownerId: products.ownerId,
        featured: products.featured,
        pinned: products.pinned,
        pinnedAt: products.pinnedAt,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        expiresAt: products.expiresAt,
        rejectionReason: products.rejectionReason,
        adminNotes: products.adminNotes,
      })
      .from(products)
      .where(
        and(
          sql`${products.status} != 'deleted'`,
          sql`EXISTS (
            SELECT 1 FROM "reports" r
            WHERE r.ad_id = ${products.id}
            AND r.status != 'resolved'
          )`
        )
      )
      .orderBy(sql`${products.createdAt} DESC`);

    const baseAds = rows.map(mapRowToProduct);
    const ads = await Promise.all(baseAds.map((ad) => mapImagesToProduct(ad.id, ad)));
    return clone(ads);
  },

  /** Count of ads per status. */
  async countByStatus(): Promise<Record<AdStatus, number>> {
    const counts: Record<AdStatus, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
      hidden: 0,
      expired: 0,
      sold: 0,
      deleted: 0,
    };

    const rows = await db
      .select({ status: products.status, count: sql<number>`COUNT(*)` })
      .from(products)
      .groupBy(products.status);

    for (const row of rows) {
      counts[row.status as AdStatus] = Number(row.count) ?? 0;
    }

    return counts;
  },

  /* ---------------------------------------------------------------------- */
  /* Mutations                                                              */
  /* ---------------------------------------------------------------------- */

  async create(input: AdCreateInput, actor: Actor): Promise<Product> {
    const now = new Date();

    // Validate images: reject blob:, data:, base64 URLs
    const images = input.images ?? [];

    // Validate: reject blob:, data:, base64 URLs
    const invalidImages = images.filter(
      (img) => img.startsWith("blob:") || img.startsWith("data:") || img.startsWith("base64")
    );
    if (invalidImages.length > 0) {
      throw new Error("Invalid image URLs detected. Please re-upload your images.");
    }

    // Validate: at least one image required
    if (!images || images.length === 0) {
      throw new Error("No images provided");
    }

    // Drizzle's `timestamp()` columns default to mode: "date", so the driver
    // mapper calls .toISOString() on whatever we pass. Pass Date objects —
    // passing ISO strings throws "e.toISOString is not a function".
    const createdAt = now;
    const updatedAt = now;
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

    const insertValues = {
      title: input.title,
      categorySlug: input.categorySlug,
      description: input.description ?? null,
      price: input.price?.toString() ?? null,
      currency: input.currency ?? "SAR",
      condition: input.condition,
      location: input.location,
      sellerName: input.sellerName,
      sellerPhone: input.sellerPhone,
      status: "pending" as AdStatus,
      ownerId: input.ownerId ?? "",
      featured: false,
      pinned: false,
      pinnedAt: null,
      createdAt,
      updatedAt,
      expiresAt,
      rejectionReason: null,
      adminNotes: null,
    } satisfies typeof products.$inferInsert;

    // Product + images must commit together. Without a transaction a failing
    // image insert leaves an ad row with no images behind.
    const result = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(products)
        .values(insertValues)
        .returning();

      // Store images in ad_images table (single source of truth)
      // Let DB generate UUIDs automatically — no "id" field passed
      const imageRecords = images.map((imgUrl, idx) => ({
        adId: inserted[0].id,
        imageUrl: imgUrl,
        sortOrder: idx,
        isPrimary: idx === 0, // Only first image is primary
      }));

      await tx.insert(adImages).values(imageRecords);

      return inserted;
    });

    console.log("[DB] ad created successfully, id:", result[0].id, "images:", images.length);

    const baseAd = mapRowToProduct(result[0]);
    const ad = await mapImagesToProduct(baseAd.id, baseAd);

    recordAdModeration(ad.id, ad.title, {
      action: "created",
      actorId: actor.id,
      actorName: actor.name,
    });

    return clone(ad);
  },

  async update(id: string, patch: AdUpdateInput, actor: Actor): Promise<Product> {
    const now = new Date();
    const updateSet: Record<string, any> = {
      updatedAt: now,
    };

    if (patch.title !== undefined) updateSet.title = patch.title;
    if (patch.description !== undefined) updateSet.description = patch.description;
    if (patch.price !== undefined) updateSet.price = patch.price?.toString() ?? null;
    if (patch.currency !== undefined) updateSet.currency = patch.currency;
    if (patch.categorySlug !== undefined) updateSet.categorySlug = patch.categorySlug;
    if (patch.condition !== undefined) updateSet.condition = patch.condition;
    if (patch.location !== undefined) updateSet.location = patch.location;
    if (patch.sellerPhone !== undefined) updateSet.sellerPhone = patch.sellerPhone;
    if (patch.images !== undefined) {
      // Validate images: reject blob:, data:, base64
      const invalidImages = patch.images.filter(
        (img: string) => img.startsWith("blob:") || img.startsWith("data:") || img.startsWith("base64")
      );
      if (invalidImages.length > 0) {
        throw new Error("Invalid image URLs detected. Please re-upload your images.");
      }

      // Replace all images in ad_images table (single source of truth)
      await db
        .delete(adImages)
        .where(eq(adImages.adId, id));

      // Insert new images — let DB generate UUIDs automatically, no "id" field passed
      if (patch.images.length > 0) {
        const imageRecords = patch.images.map((imgUrl: string, idx: number) => ({
          adId: id,
          imageUrl: imgUrl,
          sortOrder: idx,
          isPrimary: idx === 0, // Only first image is primary
        }));

        console.log("[DB] updating images for ad:", id, "count:", patch.images.length);
        console.log("[DB] image URLs:", patch.images);

        await db.insert(adImages).values(imageRecords);
      }
    }
    if (patch.adminNotes !== undefined) updateSet.adminNotes = patch.adminNotes;
    if (patch.rejectionReason !== undefined) updateSet.rejectionReason = patch.rejectionReason;

    const result = await db
      .update(products)
      .set(updateSet)
      .where(eq(products.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error(`Ad ${id} not found`);
    }

    const baseAd = mapRowToProduct(result[0]);
    const ad = await mapImagesToProduct(baseAd.id, baseAd);

    recordAdModeration(ad.id, ad.title, {
      action: "edited",
      actorId: actor.id,
      actorName: actor.name,
    });

    return clone(ad);
  },

  async approve(id: string, actor: Actor): Promise<Product> {
    // Validate state transition
    const existing = await db
      .select({ status: products.status })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`Ad ${id} not found`);
    }

    validateTransition(existing[0].status, "approved");

    const ad = await transitionWithImagesAndNotify(
      id,
      "approved",
      actor,
      { action: "approved" },
      "approved",
      undefined,
    );
    return clone(ad);
  },

  async reject(id: string, actor: Actor, reason?: string): Promise<Product> {
    // Validate state transition
    const existing = await db
      .select({ status: products.status })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`Ad ${id} not found`);
    }

    validateTransition(existing[0].status, "rejected");

    // Transaction: update product + audit log + notification
    const now = new Date();
    const result = await db.transaction(async (tx) => {
      const updateSet: Record<string, any> = {
        status: "rejected",
        updatedAt: now,
        rejectionReason: reason ?? null,
      };

      await tx
        .update(products)
        .set(updateSet)
        .where(eq(products.id, id));

      const updated = await tx
        .select()
        .from(products)
        .where(eq(products.id, id))
        .limit(1);

      const baseUpdatedAd = mapRowToProduct(updated[0]);
      const updatedAd = await mapImagesToProduct(baseUpdatedAd.id, baseUpdatedAd);

      // Audit log within transaction (fire-and-forget replaced by direct insert)
      await tx
        .insert(moderationEvents)
        .values({
          adId: updatedAd.id,
          action: "rejected",
          actorId: actor.id,
          actorName: actor.name,
          note: reason ?? null,
          createdAt: now,
        });

      return updatedAd;
    });

    // Notification outside transaction (best-effort, non-critical)
    await notifySeller(result, "rejected", reason);

    return clone(result);
  },

  async hide(id: string, actor: Actor): Promise<Product> {
    const existing = await db
      .select({ status: products.status })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`Ad ${id} not found`);
    }

    validateTransition(existing[0].status, "hidden");

    const ad = await transitionWithImages(id, "hidden", actor, { action: "hidden" });
    return clone(ad);
  },

  async unhide(id: string, actor: Actor): Promise<Product> {
    const existing = await db
      .select({ status: products.status })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`Ad ${id} not found`);
    }

    validateTransition(existing[0].status, "approved");

    const ad = await transitionWithImages(id, "approved", actor, { action: "unhidden" });
    return clone(ad);
  },

  async markSold(id: string, actor: Actor): Promise<Product> {
    const existing = await db
      .select({ status: products.status })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`Ad ${id} not found`);
    }

    validateTransition(existing[0].status, "sold");

    const ad = await transitionWithImages(id, "sold", actor, { action: "sold" });
    return clone(ad);
  },

  async renew(id: string, actor: Actor, days = 30): Promise<Product> {
    const existing = await db
      .select({ status: products.status })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`Ad ${id} not found`);
    }

    // Renewal: expired -> approved or pending -> approved
    if (existing[0].status === "expired") {
      validateTransition("expired", "approved");
    } else if (existing[0].status === "pending") {
      validateTransition("pending", "approved");
    } else {
      throw new Error(`Cannot renew ad in "${existing[0].status}" status`);
    }

    const expiresAt = new Date(Date.now() + days * 86_400_000);

    await db
      .update(products)
      .set({ expiresAt, updatedAt: new Date() })
      .where(eq(products.id, id));

    const ad = await transitionWithImagesAndNotify(
      id,
      "approved",
      actor,
      { action: "renewed" },
      "approved",
      undefined,
    );
    return clone(ad);
  },

  async remove(id: string, actor: Actor): Promise<void> {
    const existing = await db
      .select({ status: products.status })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`Ad ${id} not found`);
    }

    validateTransition(existing[0].status, "deleted");

    await transition(id, "deleted", actor, { action: "deleted" });
  },

  async setPinned(id: string, pinned: boolean, actor: Actor): Promise<Product> {
    const now = new Date();
    const pinnedAt = pinned ? now : null;

    await db
      .update(products)
      .set({ pinned, pinnedAt, updatedAt: now })
      .where(eq(products.id, id));


    const updated = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    const baseAd = mapRowToProduct(updated[0]);
    const ad = await mapImagesToProduct(baseAd.id, baseAd);

    recordAdModeration(ad.id, ad.title, {
      action: pinned ? "pinned" : "unpinned",
      actorId: actor.id,
      actorName: actor.name,
    });

    return clone(ad);
  },

  async setFeatured(id: string, featured: boolean, actor: Actor): Promise<Product> {
    const now = new Date();

    await db
      .update(products)
      .set({ featured, updatedAt: now })
      .where(eq(products.id, id));

    const updated = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    const baseAd = mapRowToProduct(updated[0]);
    const ad = await mapImagesToProduct(baseAd.id, baseAd);

    recordAdModeration(ad.id, ad.title, {
      action: featured ? "featured" : "unfeatured",
      actorId: actor.id,
      actorName: actor.name,
    });

    return clone(ad);
  },
};

/* ---------------------------------------------------------------------- */
/* Internal helpers                                                         */
/* ---------------------------------------------------------------------- */

/** Convert a date-like value to ISO string. Handles Date objects, ISO strings, and null/undefined. */
function toIsoString(val: Date | string | null | undefined): string | null {
  if (val == null) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") return val;
  return String(val);
}

/** Convert a date-like value to a numeric timestamp. Handles Date objects, ISO strings, and null/undefined. */
function toTimestamp(val: Date | string | null | undefined): number {
  if (val == null) return 0;
  if (val instanceof Date) return val.getTime();
  if (typeof val === "string") return new Date(val).getTime();
  return Number(val) || 0;
}

/** Map a Drizzle product row to the Product type. */
function mapRowToProduct(row: typeof products.$inferSelect): Product {
  const createdAtMs = toTimestamp(row.createdAt) || Date.now();
  const postedAgoHours = Math.floor((Date.now() - createdAtMs) / 3600000);

    return {
      id: row.id,
      title: row.title,
      categorySlug: row.categorySlug,
      description: row.description ?? undefined,
      price: row.price != null ? parseFloat(row.price) : 0,
      currency: row.currency ?? "SAR",
      condition: row.condition,
      location: row.location,
      sellerName: row.sellerName,
      sellerPhone: row.sellerPhone,
      status: row.status,
      ownerId: row.ownerId,
      featured: row.featured ?? false,
      pinned: row.pinned ?? false,
      pinnedAt: toIsoString(row.pinnedAt) ?? undefined,
      createdAt: toIsoString(row.createdAt) ?? new Date().toISOString(),
      updatedAt: toIsoString(row.updatedAt) ?? new Date().toISOString(),
      expiresAt: toIsoString(row.expiresAt) ?? undefined,
      rejectionReason: row.rejectionReason ?? undefined,
      adminNotes: row.adminNotes ?? undefined,
      postedAgoHours,
      image: "",
      images: [],
    };
  }

/** Transition with image mapping — used by approve, reject, hide, etc. */
async function transitionWithImages(
  id: string,
  status: AdStatus,
  actor: Actor,
  record: Omit<RecordInput, "actorId" | "actorName">,
): Promise<Product> {
  const updatedAt = new Date();

  await db
    .update(products)
    .set({ status, updatedAt })
    .where(eq(products.id, id));

  const result = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  const baseAd = mapRowToProduct(result[0]);
  const ad = await mapImagesToProduct(baseAd.id, baseAd);

  recordAdModeration(ad.id, ad.title, {
    ...record,
    actorId: actor.id,
    actorName: actor.name,
  });

  return ad;
}

/**
 * Transition with image mapping AND notification to seller.
 * Used by approve and renew operations.
 */
async function transitionWithImagesAndNotify(
  id: string,
  status: AdStatus,
  actor: Actor,
  record: Omit<RecordInput, "actorId" | "actorName">,
  notifyAction: "approved" | "rejected",
  notifyReason?: string,
): Promise<Product> {
  const updatedAt = new Date();

  await db
    .update(products)
    .set({ status, updatedAt })
    .where(eq(products.id, id));

  const result = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  const baseAd = mapRowToProduct(result[0]);
  const ad = await mapImagesToProduct(baseAd.id, baseAd);

  recordAdModeration(ad.id, ad.title, {
    ...record,
    actorId: actor.id,
    actorName: actor.name,
  });

  await notifySeller(ad, notifyAction, notifyReason);

  return ad;
}

/** Original transition without image mapping — kept for operations that don't need images returned. */
async function transition(
  id: string,
  status: AdStatus,
  actor: Actor,
  record: Omit<RecordInput, "actorId" | "actorName">,
): Promise<Product> {
  const updatedAt = new Date();

  await db
    .update(products)
    .set({ status, updatedAt })
    .where(eq(products.id, id));

  const result = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  const ad = mapRowToProduct(result[0]);

  recordAdModeration(ad.id, ad.title, {
    ...record,
    actorId: actor.id,
    actorName: actor.name,
  });

  return ad;
}

async function notifySeller(
  ad: Product,
  action: "approved" | "rejected",
  reason?: string,
) {
  if (!ad.ownerId) return;

  const title =
    action === "approved"
      ? `Your ad "${ad.title}" has been approved`
      : `Your ad "${ad.title}" has been rejected`;
  const body =
    action === "approved"
      ? "Your listing is now live in the marketplace."
      : reason
        ? `Reason: ${reason}`
        : "The listing did not meet our publication standards.";

  await notificationRepository.add({
    recipientId: ad.ownerId,
    adId: ad.id,
    type: action === "approved" ? "ad_approved" : "ad_rejected",
    title,
    body,
    read: false,
  });
}

/** Fetch category name map from DB. */
async function getCategoryNameMap(): Promise<Map<string, string>> {
  const catRows = await db
    .select()
    .from(categories);

  const map = new Map<string, string>();
  for (const cat of catRows) {
    const parts = [cat.nameEn, cat.nameAr, cat.name, cat.slug].filter(Boolean) as string[];
    map.set(cat.slug, normalizeSearchText(parts.join(" ")));
  }
  return map;
}

/* ======================================================================== */                                                          
/* Expiry cleanup */
/* ======================================================================== */

export async function runExpiryCleanup(): Promise<
  Record<"expired" | "deleted", number>
> {
  const now = new Date();

  // Find expired ads using Drizzle ORM (safe, parameterized)
  const expiredRows = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        sql`${products.expiresAt} IS NOT NULL`,
        sql`EXTRACT(EPOCH FROM ${products.expiresAt}) * 1000 <= ${now.getTime()}`,
        sql`${products.status} != 'deleted'`
      )
    );

  if (expiredRows.length === 0) {
    return { expired: 0, deleted: 0 };
  }

  const expiredIds = expiredRows.map((r) => r.id);

  // Delete related notifications using proper Drizzle ORM
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.type, "ad_expired" as any),
        inArray(notifications.adId, expiredIds)
      )
    );

  // Mark ads as deleted using proper Drizzle ORM
  await db
    .update(products)
    .set({ status: "deleted" as AdStatus, updatedAt: new Date() })
    .where(inArray(products.id, expiredIds));

  return { expired: expiredIds.length, deleted: expiredIds.length };
}

export async function countExpiredAds(): Promise<number> {
  const now = new Date();

  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(products)
    .where(
      and(
        sql`${products.expiresAt} IS NOT NULL`,
        sql`EXTRACT(EPOCH FROM ${products.expiresAt}) * 1000 <= ${now.getTime()}`,
        sql`${products.status} != 'deleted'`
      )
    );

  return rows[0]?.count ?? 0;
}

/* ======================================================================== */
/* Count helpers — for dashboard stats                                       */
/* ======================================================================== */

/**
 * Count ads by status.
 */
export async function countAdsByStatus(status: AdStatus): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(products)
    .where(eq(products.status, status));

  return Number(rows[0]?.count ?? 0);
}
