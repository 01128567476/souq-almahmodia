/**
 * GET /api/ads/[id]/stats
 *   Returns engagement stats for an ad: views, reactions, comments, favorites.
 *
 * Backend-ready: delegates entirely to repositories.
 * When Drizzle + PostgreSQL is ready, only the repositories change.
 */

import { NextRequest, NextResponse } from "next/server";
import { reactionRepository } from "@/services/repositories/reactionRepository";
import { favoriteRepository } from "@/services/repositories/favoriteRepository";
import { commentRepository } from "@/services/repositories/commentRepository";
import type { EngagementStats } from "@/types";

/* -------------------------------------------------------------------------- */
/* GET — Fetch engagement stats                                               */
/* -------------------------------------------------------------------------- */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const viewerId = _request.nextUrl.searchParams.get("viewerId");

    const [reactionSummary, favCount, commentCount, isFavorited] = await Promise.all([
      reactionRepository.getSummary(id, viewerId || null),
      favoriteRepository.countByAd(id),
      commentRepository.countByAd(id),
      viewerId
        ? favoriteRepository.isFavorited(id, viewerId)
        : Promise.resolve(false),
    ]);

    const stats: EngagementStats = {
      adId: id,
      views: 0, // TODO: Add viewRepository when needed
      reactions: reactionSummary.total,
      comments: commentCount,
      favorites: favCount,
      viewerHasFavorited: isFavorited,
    };

    return NextResponse.json({ success: true, data: stats });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 },
    );
  }
}