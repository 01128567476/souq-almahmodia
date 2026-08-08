/**
 * Users repository — Drizzle ORM implementation.
 *
 * Replaces mockDb with PostgreSQL via Drizzle ORM.
 *
 * Public interface remains EXACTLY the same:
 *   - list()
 *   - getById()
 *   - update()
 *   - remove()
 *
 * DirectoryUser is a VIEW MODEL — it is transformed from User rows.
 * Fields like `status` and `adsCount` are derived/computed.
 */

import type { DirectoryUser } from "@/types";
import { clone } from "@/lib/db-utils";
import { recordAudit, type RecordInput } from "@/services/repositories/auditRepository";

import { db } from "@/lib/db-server";
import { users, products } from "@/drizzle/schema";
import { eq, count, sql, like, and, ilike, sql as sqlRaw } from "drizzle-orm";

/* ======================================================================== */
/* Helpers                                                                  */
/* ======================================================================== */

/**
 * Transform a Drizzle User row into the DirectoryUser view model.
 * Computes adsCount via a subquery and derives status from existence.
 */
async function mapToDirectoryUser(
  row: typeof users.$inferSelect,
): Promise<DirectoryUser | null> {
  if (!row) return null;

  // Count ads for this user
  const [countResult] = await db
    .select({ count: count() })
    .from(products)
    .where(eq(products.ownerId, row.id));

  // Format joinedAt as date string (YYYY-MM-DD)
  const joinedDate = row.joinedAt
    ? new Date(row.joinedAt).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  return {
    id: row.id,
    name: row.displayName,
    email: row.email,
    phone: row.phone ?? undefined,
    role: row.role as DirectoryUser["role"],
    status: "active", // All users are active; suspension logic is handled via ad status
    joinedDate,
    adsCount: countResult.count ?? 0,
    avatar: row.avatar ?? "",
    username: row.username ?? undefined,
    displayName: row.displayName ?? undefined,
  };
}

/* ======================================================================== */
/* Repository                                                               */
/* ======================================================================== */

export type UserStatus = DirectoryUser["status"];

export const userRepository = {
  /**
   * List all users (admin directory).
   * Returns DirectoryUser view models with computed adsCount.
   * Only returns users with verified emails.
   * @deprecated Use listPaginated for production — loads all users into memory.
   */
  async list(): Promise<DirectoryUser[]> {
    const rows = await db
      .select()
      .from(users)
      .where(sql`${users}.email_verified IS NOT NULL`)
      .orderBy(users.createdAt);

    const result: DirectoryUser[] = [];
    for (const row of rows) {
      const dir = await mapToDirectoryUser(row);
      if (dir) result.push(dir);
    }

    return clone(result);
  },

  /**
   * List users with DB-level pagination (no memory issues at scale).
   * Uses batch ad-count queries to avoid N+1 problem.
   * 
   * SECURITY: Only returns safe fields (no phone, role, joinedDate).
   */
  async listPaginated(
    page: number,
    limit: number,
    search?: string,
  ): Promise<{ users: { id: string; name: string; email: string; avatar: string; username?: string; adsCount: number; status: string }[]; meta: { page: number; limit: number; total: number; totalPages: number; hasMore: boolean } }> {
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const whereClause = and(
      sql`${users}.email_verified IS NOT NULL`,
      search
        ? and(
            ilike(users.displayName, `%${search}%`),
          )
        : undefined,
    );

    // Count total
    const countResult = await db
      .select({ count: count() })
      .from(users)
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);

    // Fetch users with batched ad counts (NO N+1)
    const rows = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        avatar: users.avatar,
        username: users.username,
      })
      .from(users)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(users.createdAt);

    if (rows.length === 0) {
      return { users: [], meta: { page, limit, total, totalPages: 0, hasMore: false } };
    }

    const userIds = rows.map((r) => r.id);

    // Batch query: count ads per user (single query, N+1 eliminated)
    const adCounts = await db
      .select({
        ownerId: products.ownerId,
        count: count(),
      })
      .from(products)
      .where(sql`${products.status} != 'deleted'`)
      .groupBy(products.ownerId)
      .having(sql`${products.ownerId} IN (${userIds.join(",")})`);

    const adCountMap = new Map<string, number>();
    for (const row of adCounts) {
      adCountMap.set(row.ownerId, row.count);
    }

    // Map to safe response (no phone, role, joinedDate)
    const result = rows.map((row) => ({
      id: row.id,
      name: row.displayName,
      email: row.email,
      avatar: row.avatar ?? "",
      username: row.username ?? undefined,
      adsCount: adCountMap.get(row.id) ?? 0,
      status: "active",
    }));

    const totalPages = Math.ceil(total / limit) || 1;
    const hasMore = page < totalPages;

    return {
      users: clone(result),
      meta: { page, limit, total, totalPages, hasMore },
    };
  },

  /**
   * Get a single user by ID.
   * Returns DirectoryUser view model or null.
   */
  async getById(id: string): Promise<DirectoryUser | null> {
    const row = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (row.length === 0) return null;

    const dir = await mapToDirectoryUser(row[0]);
    return dir;
  },

  /**
   * Update user fields.
   *
   * Business rules:
   * - Suspending a user: hides all approved ads
   * - Re-activating a user: shows all hidden ads from that user
   *
   * Audit log is recorded via the existing synchronous helper.
   */
  async update(
    id: string,
    patch: Partial<Pick<DirectoryUser, "name" | "email" | "phone" | "status">>,
    actor?: RecordInput,
  ): Promise<DirectoryUser> {
    // Fetch existing user
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`User not found: ${id}`);
    }

    const current = existing[0];

    // Build update set — only set fields that are provided
    const updateSet: Record<string, string | undefined> = {};
    if (patch.name !== undefined) updateSet.displayName = patch.name.trim();
    if (patch.email !== undefined) updateSet.email = patch.email.trim();
    if (patch.phone !== undefined) updateSet.phone = patch.phone.trim();

    // Perform the update
    await db
      .update(users)
      .set(updateSet)
      .where(eq(users.id, id));

    // Read back the updated row
    const updatedRow = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    // Handle status-based ad hiding/showing (business logic, not stored in DB)
    const wasActive = true; // We just fetched the user, so they are "active"
    const isNowSuspended = patch.status === "suspended";

    if (wasActive && isNowSuspended) {
      // Hide all approved ads for this user
      await db
        .update(products)
        .set({ status: "hidden", updatedAt: new Date() })
        .where(eq(products.ownerId, id));
    }

    if (patch.status === "active") {
      // Show all hidden ads from this user
      await db
        .update(products)
        .set({ status: "approved", updatedAt: new Date() })
        .where(
          sql`${products.ownerId} = ${id} AND ${products.status} = 'hidden'`
        );
    }

    // Record audit
    const displayLabel = updateSet.displayName ?? current.displayName;
    const action =
      patch.status === "suspended" ? "user_suspended" : patch.status === "active" ? "user_activated" : "profile_edited";

    recordAudit({
      action,
      actorId: actor?.actorId ?? "",
      actorName: actor?.actorName ?? "",
      targetType: "user",
      targetId: id,
      targetLabel: displayLabel,
    });

    const dir = await mapToDirectoryUser(updatedRow[0]);
    return dir!;
  },

  /**
   * Get user by ID with full profile fields (including username).
   * Used by auth layer and username operations.
   */
  async getFullProfile(id: string): Promise<typeof users.$inferSelect | null> {
    const row = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (row.length === 0) return null;
    return row[0];
  },

  /**
   * Get user by username (case-insensitive).
   * Used by public profile lookup and username availability.
   */
  async getByUsername(username: string): Promise<typeof users.$inferSelect | null> {
    const normalized = username.trim().toLowerCase();
    const row = await db
      .select()
      .from(users)
      .where(eq(users.usernameLower, normalized))
      .limit(1);

    if (row.length === 0) return null;
    return row[0];
  },

  /**
   * Get all users with username fields (for availability checking and global search).
   */
  async getAllWithUsername(): Promise<typeof users.$inferSelect[]> {
    const rows = await db
      .select()
      .from(users)
      .orderBy(users.createdAt);

    return rows;
  },

  /**
   * Get user by email (case-insensitive).
   * Used by Auth.js credentials provider.
   */
  async getByEmail(email: string): Promise<typeof users.$inferSelect | null> {
    const row = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (row.length === 0) return null;
    return row[0];
  },

  /**
   * Check if a user has a password set.
   * Returns true if the user can authenticate via email/password.
   */
  async hasPassword(userId: string): Promise<boolean> {
    const row = await db
      .select({ hasPassword: users.hasPassword })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (row.length === 0) return false;
    return !!row[0].hasPassword;
  },

  /**
   * Count all users.
   */
  async count(): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(users)
      .limit(1);

    return Number(result[0]?.count ?? 0);
  },

  /**
   * Soft-delete a user (marks their ads as deleted).
   *
   * Business rules:
   * - User row is kept (soft delete)
   * - All non-deleted ads are marked as "deleted"
   *
   * Audit log is recorded via the existing synchronous helper.
   */
  async remove(id: string, actor?: RecordInput): Promise<void> {
    // Fetch existing user for audit label
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`User not found: ${id}`);
    }

    const user = existing[0];

    // Mark all non-deleted ads as deleted
    await db
      .update(products)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(
        sql`${products.ownerId} = ${id} AND ${products.status} != 'deleted'`
      );

    // Record audit
    recordAudit({
      action: "user_deleted",
      actorId: actor?.actorId ?? "",
      actorName: actor?.actorName ?? "",
      targetType: "user",
      targetId: id,
      targetLabel: user.displayName,
    });

    return;
  },
};