/**
 * GET /api/ads/[id]/favorites
 *   Returns the favorite count and whether the viewer has favorited.
 *
 * POST /api/ads/[id]/favorites
 *   Toggle the viewer's favorite for an ad.
 *   - Uses transaction for consistency (no race conditions)
 *   - Returns authoritative server state: { favorited, count }
 *
 * Production-only. No mock data. No temporary code.
 * User identity derived from Auth.js session.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-server";
import { favorites } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/serverAuth";

/* -------------------------------------------------------------------------- */
/* GET — Fetch favorite count                                                 */
/* -------------------------------------------------------------------------- */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const viewerId = url.searchParams.get("viewerId");

    // Count favorites for this ad
    const [{ count }] = await db
      .select({ count: db.$count(favorites) })
      .from(favorites)
      .where(eq(favorites.adId, id));

    // Check if viewer favorited
    let isFavorited = false;
    if (viewerId) {
      const existing = await db
        .select({ id: favorites.id })
        .from(favorites)
        .where(and(eq(favorites.adId, id), eq(favorites.userId, viewerId)))
        .limit(1);
      isFavorited = existing.length > 0;
    }

    return NextResponse.json({ success: true, data: { count: Number(count), isFavorited } });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch favorites" },
      { status: 500 },
    );
  }
}

/* -------------------------------------------------------------------------- */
/* POST — Toggle favorite (transactional — no race conditions)               */
/* -------------------------------------------------------------------------- */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: adId } = await params;

    // Derive userId from Auth.js session (not from client)
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const userId = currentUser.id;

    // Transactional toggle — all reads and writes happen on the same connection
    const result = await db.transaction(async (tx) => {
      // Check if this user already favorited this ad
      const existing = await tx
        .select({ id: favorites.id })
        .from(favorites)
        .where(and(eq(favorites.adId, adId), eq(favorites.userId, userId)))
        .limit(1);

      if (existing.length > 0) {
        // DELETE the favorite
        await tx
          .delete(favorites)
          .where(and(eq(favorites.adId, adId), eq(favorites.userId, userId)));

        // Re-count
        const [{ count }] = await tx
          .select({ count: db.$count(favorites) })
          .from(favorites)
          .where(eq(favorites.adId, adId));

        return { favorited: false, count: Number(count) };
      }

      // INSERT (ON CONFLICT DO NOTHING prevents duplicates on race)
      await tx
        .insert(favorites)
        .values({ adId, userId })
        .onConflictDoNothing();

      // Re-count
      const [{ count }] = await tx
        .select({ count: db.$count(favorites) })
        .from(favorites)
        .where(eq(favorites.adId, adId));

      return { favorited: true, count: Number(count) };
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[FAVORITE_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to toggle favorite" },
      { status: 500 },
    );
  }
}