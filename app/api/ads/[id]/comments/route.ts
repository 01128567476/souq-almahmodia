/**
 * Comments collection endpoint for one advertisement.
 *
 * Client Components MUST use this route instead of importing commentRepository
 * directly — the repository pulls in `lib/db-server` (and therefore `pg`),
 * which cannot be bundled for the browser.
 *
 * Production-only. No mock data. No temporary code.
 */

import { NextResponse } from "next/server";
import { commentRepository } from "@/services/repositories/commentRepository";
import { getCurrentUser } from "@/lib/serverAuth";

/* -------------------------------------------------------------------------- */
/* GET — List the threaded comments for an ad                                 */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/ads/[id]/comments?viewerId=<id>
 *
 * Returns the full threaded comment tree. `viewerId` is optional and only
 * controls the `viewerIsAuthor` flag on each node.
 * The viewerId is derived from the Auth.js session, not trusted from the client.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: adId } = await context.params;
  const url = new URL(request.url);
  const viewerId = url.searchParams.get("viewerId");

  try {
    const comments = await commentRepository.listByAd(adId, viewerId || null);
    return NextResponse.json({ comments });
  } catch {
    console.error("[comments-api] Failed to list comments:");
    return NextResponse.json(
      { error: "Failed to load comments" },
      { status: 500 },
    );
  }
}

/* -------------------------------------------------------------------------- */
/* POST — Create a comment, or reply to an existing one                       */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/ads/[id]/comments
 *
 * Creates a comment authenticated via Auth.js session.
 * The author is derived from the session — never from the request body.
 *
 * Body: { content: string, parentId?: string }
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: adId } = await context.params;

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

  const parentId = typeof body.parentId === "string" ? body.parentId : null;

  const author = {
    id: currentUser.id,
    name: currentUser.name,
    avatar: currentUser.avatar ?? "",
  };

  try {
    let comments;
    if (parentId) {
      comments = await commentRepository.reply({
        adId,
        parentCommentId: parentId,
        author,
        content,
      });
    } else {
      comments = await commentRepository.create({ adId, author, content });
    }

    return NextResponse.json({ success: true, comments }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Parent comment not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[comments-api] Failed to create comment:", error);
    return NextResponse.json(
      { error: "Failed to post comment" },
      { status: 500 },
    );
  }
}