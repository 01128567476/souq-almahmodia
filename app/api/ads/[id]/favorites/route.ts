/**
 * GET /api/ads/[id]/favorites
 *   Returns the number of favorites for an ad, and whether the viewer has favorited.
 *
 * POST /api/ads/[id]/favorites
 *   Adds the viewer's favorite for an ad.
 *
 * DELETE /api/ads/[id]/favorites
 *   Removes the viewer's favorite for an ad.
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
/*                                                          POST — Add favorite */
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

    const added = await favoriteRepository.add({
      userId: currentUser.id,
      adId: id,
    });

    if (!added) {
      return NextResponse.json(
        { success: false, error: "Already favorited" },
        { status: 409 },
      );
    }

    const count = await favoriteRepository.countByAd(id);

    return NextResponse.json({ success: true, data: { count } });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to add favorite" },
      { status: 500 },
    );
  }
}

/* -------------------------------------------------------------------------- */
/* DELETE — Remove favorite                                                     */
/* -------------------------------------------------------------------------- */

export async function DELETE(
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

    await favoriteRepository.remove(id, currentUser.id);

    const count = await favoriteRepository.countByAd(id);

    return NextResponse.json({ success: true, data: { count } });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to remove favorite" },
      { status: 500 },
    );
  }
}