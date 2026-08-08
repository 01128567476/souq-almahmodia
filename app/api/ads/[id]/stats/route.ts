/**
 * GET /api/ads/[id]/stats
 *   Returns engagement stats for a single ad.
 *
 * Response format:
 * {
 *   stats: { adId, views, reactions, comments, favorites, viewerHasFavorited }
 * }
 *
 * Always returns a valid stats object — never null/undefined.
 */

import { NextRequest, NextResponse } from "next/server";
import { reactionRepository } from "@/services/repositories/reactionRepository";
import { favoriteRepository } from "@/services/repositories/favoriteRepository";
import { commentRepository } from "@/services/repositories/commentRepository";
import type { EngagementStats } from "@/types";

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
      views: 0,
      reactions: reactionSummary.total,
      comments: commentCount,
      favorites: favCount,
      viewerHasFavorited: isFavorited,
    };

    return NextResponse.json({ stats });
  } catch {
    // Return default stats on error
    return NextResponse.json({
      stats: {
        adId: (await params).id,
        views: 0,
        reactions: 0,
        comments: 0,
        favorites: 0,
        viewerHasFavorited: false,
      },
    });
  }
}