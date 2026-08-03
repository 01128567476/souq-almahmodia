/**
 * Single comment endpoints — PATCH (edit) and DELETE.
 *
 * Production-only. No mock data. No temporary code.
 * All identity/role data comes from Auth.js session.
 */

import { NextResponse } from "next/server";
import { commentRepository } from "@/services/repositories/commentRepository";
import { adRepository } from "@/services/repositories/adRepository";
import { getCurrentUser } from "@/lib/serverAuth";
import { isAdmin } from "@/lib/permissions";

/* -------------------------------------------------------------------------- */
/* Route Handlers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * PATCH /api/ads/[id]/comments/[commentId]
 *
 * Edits a comment's body. Only the comment's own author may edit it.
 * Authentication: Auth.js session via getCurrentUser().
 * Authorization: server-side ownership check in commentRepository.edit().
 *
 * Body: { content: string }
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; commentId: string }> },
) {
  const { commentId } = await context.params;

  // Authenticate via Auth.js session
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json(
      { error: "Comment content is required" },
      { status: 400 },
    );
  }

  try {
    // The repository enforces "author only" and throws otherwise.
    const comments = await commentRepository.edit(commentId, { content }, currentUser.id);
    return NextResponse.json({ success: true, comments });
  } catch (error) {
    if (error instanceof Error && error.message === "Comment not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error && error.message === "Not authorized") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[comments-api] Failed to edit comment:", error);
    return NextResponse.json(
      { error: "Failed to edit comment" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/ads/[id]/comments/[commentId]
 *
 * Removes a single comment (and, when it is a root comment, its replies) after
 * the server re-validates deletion permissions.
 *
 * Permission rules (enforced server-side):
 *  - admin           → any comment on any ad            (200)
 *  - ad owner        → any comment on their own ad      (200)
 *  - comment author  → only their own comment           (200)
 *  - anyone else     → 403 Forbidden
 *
 * AUTHENTICATION: Auth.js session via getCurrentUser().
 */

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; commentId: string }> },
) {
  const { id: adId, commentId } = await context.params;

  // Authenticate via Auth.js session
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  try {
    // Fetch the ad to get the owner for permission checks.
    const ad = await adRepository.getById(adId);
    if (!ad) {
      return NextResponse.json(
        { error: "Ad not found" },
        { status: 404 },
      );
    }

    // Fetch the comment to validate authorization.
    const comment = await commentRepository.getById(commentId);
    if (!comment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 },
      );
    }

    // Authorization: admin | ad owner | comment author
    const isAdminRole = isAdmin(currentUser.role);
    const isAdOwner = ad.ownerId === currentUser.id;
    const isCommentAuthor = comment.author.id === currentUser.id;

    if (!isAdminRole && !isAdOwner && !isCommentAuthor) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 },
      );
    }

    // Soft-delete (status = "deleted"). Authorization already verified above.
    const comments = await commentRepository.remove(commentId, currentUser.id);
    return NextResponse.json({ success: true, comments });
  } catch (error) {
    if (error instanceof Error && error.message === "Comment not found") {
      return NextResponse.json(
        { error: error.message },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 },
    );
  }
}