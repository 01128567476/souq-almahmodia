/**
 * Favorite repository — Drizzle ORM implementation.
 *
 * Production-grade: uses ON CONFLICT to prevent race conditions.
 * No SELECT-then-INSERT patterns.
 *
 * Public interface remains EXACTLY the same.
 */

import type { FavoriteRow } from "@/types";
import { db } from "@/lib/db-server";
import { favorites } from "@/drizzle/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { clone } from "@/lib/db-utils";

/** Convert a date-like value to ISO string. Handles Date, ISO string, null/undefined. Returns fallback for null. */
function toIsoString(val: Date | string | null | undefined, fallback?: string): string {
  if (val == null) return fallback ?? new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") return val;
  return String(val);
}

/* -------------------------------------------------------------------------- */
/* Input types                                                                */
/* -------------------------------------------------------------------------- */

/** Input for adding a favorite. */
export interface FavoriteAddInput {
  userId: string;
  adId: string;
}

/** Input for creating a new favorite (for API routes that accept explicit body). */
export interface FavoriteCreateInput {
  userId: string;
  adId: string;
}

/* -------------------------------------------------------------------------- */
/* Repository                                                                 */
/* -------------------------------------------------------------------------- */

export const favoriteRepository = {
  /**
   * Add a favorite — production-safe.
   *
   * Uses ON CONFLICT DO NOTHING to prevent race conditions.
   * If the unique constraint (userId, adId) is violated, the INSERT silently fails.
   * Returns true if a new favorite was created, false if it already existed.
   */
  async add(input: FavoriteAddInput): Promise<boolean> {
    const result = await db
      .insert(favorites)
      .values({
        userId: input.userId,
        adId: input.adId,
        createdAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: favorites.id });

    // If result is non-empty, a new row was inserted
    return result.length > 0;
  },

  /**
   * Remove a favorite.
   */
  async remove(adId: string, userId: string): Promise<void> {
    await db
      .delete(favorites)
      .where(
        and(
          eq(favorites.userId, userId),
          eq(favorites.adId, adId),
        ),
      );

    return;
  },

  /**
   * Check if a user has favorited a specific ad.
   */
  async isFavorited(adId: string, userId: string): Promise<boolean> {
    const existing = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, userId),
          eq(favorites.adId, adId),
        ),
      )
      .limit(1);

    return Number(existing[0]?.count ?? 0) > 0;
  },

  /**
   * Get all favorites for a user (for "My Favorites" page).
   */
  async listByUser(userId: string): Promise<FavoriteRow[]> {
    const rows = await db
      .select()
      .from(favorites)
      .where(eq(favorites.userId, userId))
      .orderBy(asc(favorites.createdAt));

    const result: FavoriteRow[] = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      adId: row.adId,
      createdAt: toIsoString(row.createdAt),
    }));

    return clone(result);
  },

  /**
   * Count how many times an ad has been favorited.
   */
  async countByAd(adId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(favorites)
      .where(eq(favorites.adId, adId));

    return Number(result[0]?.count ?? 0);
  },

  /**
   * Get the number of favorites a user has made.
   */
  async countByUser(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(favorites)
      .where(eq(favorites.userId, userId));

    return Number(result[0]?.count ?? 0);
  },
};