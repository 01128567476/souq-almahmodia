/**
 * Reaction repository — Drizzle ORM implementation.
 *
 * Production-grade: uses database-level unique constraint (unique_reaction)
 * to prevent race conditions. ON CONFLICT is handled by the database.
 *
 * Public interface remains EXACTLY the same.
 */

import type { ReactionRow, ReactionType, ReactionSummary } from "@/types";
import { db } from "@/lib/db-server";
import { reactions } from "@/drizzle/schema";
import { eq, and, asc, count, desc } from "drizzle-orm";
import { clone } from "@/lib/db-utils";

/* -------------------------------------------------------------------------- */
/* Reaction Type helper                                                     */
/* -------------------------------------------------------------------------- */

/** Validate that a string is a known reaction type. */
function isValidReactionType(value: unknown): value is ReactionType {
  return typeof value === "string" && ["like", "love", "funny", "wow", "sad"].includes(value);
}

/* -------------------------------------------------------------------------- */
/* Input types                                                                */
/* -------------------------------------------------------------------------- */

/** Input for creating or updating a reaction. */
export interface ReactionUpsertInput {
  adId: string;
  userId: string;
  type: ReactionType;
}

/* -------------------------------------------------------------------------- */
/* Repository                                                                 */
/* -------------------------------------------------------------------------- */

export const reactionRepository = {
  /**
   * Upsert a reaction — production-safe.
   *
   * Uses Drizzle's onConflictDoUpdate for atomic upsert.
   * The database-level unique constraint (unique_reaction) prevents race conditions.
   *
   * If the user already has a reaction on this ad, the type is updated.
   * Otherwise, a new reaction is created.
   */
  async upsert(input: ReactionUpsertInput): Promise<void> {
    try {
      await db
        .insert(reactions)
        .values({
          adId: input.adId,
          userId: input.userId,
          type: input.type,
        })
        .onConflictDoUpdate({
          target: [reactions.adId, reactions.userId],
          set: { type: input.type },
        });
    } catch (error) {
      console.error("[reactionRepository.upsert] Failed:", error);
      throw error;
    }
  },

  /**
   * Remove a user's reaction from an ad.
   * Returns the number of affected rows (0 = nothing was removed).
   */
  async remove(adId: string, userId: string): Promise<number> {
    const result = await db
      .delete(reactions)
      .where(
        and(
          eq(reactions.adId, adId),
          eq(reactions.userId, userId),
        ),
      )
      .returning({ affectedUserId: reactions.userId });

    return result.length;
  },

  /**
   * Get all reactions for an ad.
   */
  async listByAd(adId: string): Promise<ReactionRow[]> {
    const rows = await db
      .select()
      .from(reactions)
      .where(eq(reactions.adId, adId))
      .orderBy(asc(reactions.createdAt));

    const result: ReactionRow[] = rows.map((row) => ({
      id: row.id,
      adId: row.adId,
      userId: row.userId,
      type: row.type,
      createdAt: row.createdAt.toISOString(),
    }));

    return clone(result);
  },

  /**
   * Get a single reaction (ad + user).
   */
  async get(adId: string, userId: string): Promise<ReactionRow | null> {
    const rows = await db
      .select()
      .from(reactions)
      .where(
        and(
          eq(reactions.adId, adId),
          eq(reactions.userId, userId),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    const result: ReactionRow = {
      id: row.id,
      adId: row.adId,
      userId: row.userId,
      type: row.type,
      createdAt: row.createdAt.toISOString(),
    };

    return clone(result);
  },

  /**
   * Get the viewer's reaction type on an ad (for UI state).
   * Returns null if the viewer has not reacted.
   */
  async getViewerReactionType(
    adId: string,
    userId: string,
  ): Promise<ReactionType | null> {
    const rows = await db
      .select({ type: reactions.type })
      .from(reactions)
      .where(
        and(
          eq(reactions.adId, adId),
          eq(reactions.userId, userId),
        ),
      )
      .limit(1);

    return rows[0]?.type ?? null;
  },

  /**
   * Get the aggregate summary for an ad (counts per type + viewer reaction).
   * Returns safe default when no reactions exist or viewerId is null.
   *
   * IMPORTANT: This must be called within the same transaction as remove/upsert
   * to avoid read-after-write inconsistency from connection pooling.
   */
  async getSummary(
    adId: string,
    viewerId: string | null,
  ): Promise<ReactionSummary> {
    const rows = await db
      .select()
      .from(reactions)
      .where(eq(reactions.adId, adId));

    const counts: Record<ReactionType, number> = {
      like: 0,
      love: 0,
      funny: 0,
      wow: 0,
      sad: 0,
    };

    let viewerReaction: ReactionType | null = null;

    for (const row of rows) {
      if (isValidReactionType(row.type)) {
        counts[row.type] = (counts[row.type] ?? 0) + 1;
      }
      // Check if this row belongs to the viewer
      if (viewerId && row.userId === viewerId) {
        viewerReaction = row.type;
      }
    }

    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

    return { total, counts, viewerReaction };
  },

  /**
   * Get all reactions by a user (for "My Reactions" page).
   */
  async listByUser(userId: string): Promise<ReactionRow[]> {
    const rows = await db
      .select()
      .from(reactions)
      .where(eq(reactions.userId, userId))
      .orderBy(desc(reactions.createdAt));

    const result: ReactionRow[] = rows.map((row) => ({
      id: row.id,
      adId: row.adId,
      userId: row.userId,
      type: row.type,
      createdAt: row.createdAt.toISOString(),
    }));

    return clone(result);
  },
};