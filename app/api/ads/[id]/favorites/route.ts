/**
 * GET /api/ads/[id]/favorites
 *   Returns the favorite count and whether the viewer has favorited.
 *
 * POST /api/ads/[id]/favorites
 *   Toggles the viewer's favorite for an ad.
 *   - If favorite exists → removes it
 *   - If favorite doesn't exist → creates it
 *   - Returns consistent response: { favorited, count }
 *
 * Production-only. No mock data. No temporary code.
 * User identity derived from Auth.js session.
 */

import { NextRequest, NextResponse } from "next/server";
import { favoriteRepository } from "@/services/repositories/favoriteRepository";
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

    const count = await favoriteRepository.countByAd(id);
    const isFavorited = viewerId
      ? await favoriteRepository.isFavorited(id, viewerId)
      : false;

    return NextResponse.json({ success: true, data: { count, isFavorited } });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch favorites" },
      { status: 500 },
    );
  }
}

/* -------------------------------------------------------------------------- */
/* POST — Toggle favorite (add if absent, remove if present)                 */
/* -------------------------------------------------------------------------- */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;

    // Derive userId from Auth.js session (not from client)
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const userId = currentUser.id;
    const adId = id;

    // Check if already favorited
    const alreadyFavorited = await favoriteRepository.isFavorited(adId, userId);

    if (alreadyFavorited) {
      // Remove the favorite
      await favoriteRepository.remove(adId, userId);
      const count = await favoriteRepository.countByAd(adId);

      return NextResponse.json({
        success: true,
        data: {
          favorited: false,
          count,
        },
      });
    }

    // Add the favorite (uses ON CONFLICT DO NOTHING — safe against race conditions)
    const added = await favoriteRepository.add({ userId, adId });

    const count = await favoriteRepository.countByAd(adId);

    return NextResponse.json({
      success: true,
      data: {
        favorited: added,
        count,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to toggle favorite" },
      { status: 500 },
    );
  }
}