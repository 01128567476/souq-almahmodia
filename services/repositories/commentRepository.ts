/**
 * Comment repository — Drizzle ORM implementation.
 *
 * Replaces mockDb with PostgreSQL via Drizzle ORM.
 *
 * Public interface remains EXACTLY the same.
 */

import type { Comment } from "@/types";
import { db } from "@/lib/db-server";
import { comments } from "@/drizzle/schema";
import { eq, and, asc } from "drizzle-orm";
import { clone } from "@/lib/db-utils";
import { sql } from "drizzle-orm";
import { desc } from "drizzle-orm";

/* -------------------------------------------------------------------------- */
/* Helpers — flat list → threaded tree                                        */
/* -------------------------------------------------------------------------- */

/**
 * Build a threaded tree from a flat list of stored comments.
 * Returns Comment[] in the shape the UI expects (with replies arrays).
 * Recursively builds unlimited nesting depth.
 */
function buildThread(
  flat: Array<{
    id: string;
    adId: string;
    parentId: string | null;
    author: { id: string; name: string; avatar: string };
    body: string;
    createdAt: string;
    editedAt: string | null;
    status: string;
  }>,
  viewerId: string | null,
): Comment[] {
  const byParent = new Map<string | null, typeof flat>();
  for (const c of flat) {
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }

  function children(parentId: string | null): Comment[] {
    const rows = byParent.get(parentId) ?? [];
    return rows
      .filter((c) => c.status === "visible")
      .sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      .map((c) => ({
        id: c.id,
        adId: c.adId,
        parentId: c.parentId,
        author: c.author,
        body: c.body,
        createdAt: c.createdAt,
        edited: c.editedAt !== null,
        viewerIsAuthor: viewerId != null && c.author.id === viewerId,
        replies: children(c.id),
      }));
  }

  return children(null);
}

function mapRowToStoredComment(
  row: typeof comments.$inferSelect,
): {
  id: string;
  adId: string;
  parentId: string | null;
  author: { id: string; name: string; avatar: string };
  body: string;
  createdAt: string;
  editedAt: string | null;
  status: string;
} {
  return {
    id: row.id,
    adId: row.adId,
    parentId: row.parentId,
    author: {
      id: row.authorId,
      name: row.authorName,

         avatar: row.authorAvatar ?? "", },
    body: row.content,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    status: row.status,
  };
}

/* -------------------------------------------------------------------------- */
/* Repository                                                                 */
/* -------------------------------------------------------------------------- */

export interface CreateCommentInput {
  adId: string;
  author: { id: string; name: string; avatar: string };
  content: string;
}

export interface ReplyCommentInput {
  adId: string;
  parentCommentId: string;
  author: { id: string; name: string; avatar: string };
  content: string;
}

export interface EditCommentInput {
  content: string;
}

export const commentRepository = {
  /**
   * List threaded comments for an ad (newest-first at root level).
   * Deleted/hidden comments are excluded from the tree.
   */
  async listByAd(adId: string, viewerId: string | null = null): Promise<Comment[]> {
    const rows = await db
      .select()
      .from(comments)
      .where(eq(comments.adId, adId));

    const flat = rows.map(mapRowToStoredComment);
    return buildThread(flat, viewerId);
  },

  /**
   * Get a single comment by id (returns flat shape with empty replies).
   */
  async getById(id: string): Promise<Comment | null> {
    const rows = await db
      .select()
      .from(comments)
      .where(eq(comments.id, id))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    const result: Comment = {
      id: row.id,
      adId: row.adId,
      parentId: row.parentId,
      author: {
        id: row.authorId,
        name: row.authorName,
        avatar: row.authorAvatar ?? "",
      },
      body: row.content,
      createdAt: row.createdAt.toISOString(),
      edited: row.editedAt !== null,
      viewerIsAuthor: false,
      replies: [],
    };

    return clone(result);
  },

  /**
   * Create a new top-level comment on an ad.
   */
  async create(input: CreateCommentInput): Promise<Comment[]> {
    const now = new Date();
    await db
      .insert(comments)
      .values({
        adId: input.adId,
        parentId: null,
        authorId: input.author.id,
        authorName: input.author.name,
        authorAvatar: input.author.avatar ?? "",
        content: input.content.trim(),
        status: "visible",
        createdAt: now,
        updatedAt: now,
        editedAt: null,
      });

    // Fetch all comments for the ad to rebuild the thread
    const rows = await db
      .select()
      .from(comments)
      .where(eq(comments.adId, input.adId));

    const flat = rows.map(mapRowToStoredComment);
    return buildThread(flat, input.author.id);
  },

  /**
   * Create a reply to an existing comment (unlimited nesting depth).
   */
  async reply(input: ReplyCommentInput): Promise<Comment[]> {
    // Verify parent exists
    const parentRows = await db
      .select()
      .from(comments)
      .where(eq(comments.id, input.parentCommentId))
      .limit(1);

    if (parentRows.length === 0) {
      throw new Error("Parent comment not found");
    }

    const now = new Date();
    await db
      .insert(comments)
      .values({
        adId: input.adId,
        parentId: input.parentCommentId,
        authorId: input.author.id,
        authorName: input.author.name,
        authorAvatar: input.author.avatar ?? "",
        content: input.content.trim(),
        status: "visible",
        createdAt: now,
        updatedAt: now,
        editedAt: null,
      });

    // Fetch all comments for the ad to rebuild the thread
    const rows = await db
      .select()
      .from(comments)
      .where(eq(comments.adId, input.adId));

    const flat = rows.map(mapRowToStoredComment);
    return buildThread(flat, input.author.id);
  },

  /**
   * Edit an existing comment (author only).
   */
  async edit(
    id: string,
    input: EditCommentInput,
    viewerId: string,
  ): Promise<Comment[]> {
    const row = await db
      .select()
      .from(comments)
      .where(eq(comments.id, id))
      .limit(1);

    if (row.length === 0) {
      throw new Error("Comment not found");
    }

    if (row[0].authorId !== viewerId) {
      throw new Error("Not authorized");
    }

    const now = new Date();
    await db
      .update(comments)
      .set({
        content: input.content.trim(),
        updatedAt: now,
        editedAt: now,
      })
      .where(eq(comments.id, id));

    // Fetch all comments for the ad to rebuild the thread
    const rows = await db
      .select()
      .from(comments)
      .where(eq(comments.adId, row[0].adId));

    const flat = rows.map(mapRowToStoredComment);
    return buildThread(flat, viewerId);
  },

  /**
   * Soft-delete a comment (marks as "deleted"; replies remain hidden).
   * Author can delete their own comment.
   */
  async remove(id: string, viewerId: string): Promise<Comment[]> {
    const row = await db
      .select()
      .from(comments)
      .where(eq(comments.id, id))
      .limit(1);

    if (row.length === 0) {
      throw new Error("Comment not found");
    }

    if (row[0].authorId !== viewerId) {
      throw new Error("Not authorized");
    }

    const now = new Date();
    await db
      .update(comments)
      .set({ status: "deleted", updatedAt: now })
      .where(eq(comments.id, id));

    // Fetch all comments for the ad to rebuild the thread
    const rows = await db
      .select()
      .from(comments)
      .where(eq(comments.adId, row[0].adId));

    const flat = rows.map(mapRowToStoredComment);
    return buildThread(flat, viewerId);
  },

  /**
   * Count visible comments for an ad.
   */
  async countByAd(adId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(comments)
      .where(
        and(
          eq(comments.adId, adId),
          eq(comments.status, "visible"),
        ),
      );

    return Number(result[0]?.count ?? 0);
  },

  /**
   * List all comments by an author (flat, for "My Comments" pages).
   */
  async listByAuthor(authorId: string): Promise<Comment[]> {
    const rows = await db
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.authorId, authorId),
          eq(comments.status, "visible"),
        ),
      )
      .orderBy(desc(comments.createdAt));

    const result: Comment[] = rows.map((row) => ({
      id: row.id,
      adId: row.adId,
      parentId: row.parentId,
      author: {
        id: row.authorId,
        name: row.authorName,
        avatar: row.authorAvatar ?? "",
      },
      body: row.content,
      createdAt: row.createdAt.toISOString(),
      edited: row.editedAt !== null,
      viewerIsAuthor: true,
      replies: [],
    }));

    return result;
  },
};