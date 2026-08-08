import { NextRequest, NextResponse } from "next/server";
import { reactionRepository } from "@/services/repositories/reactionRepository";
import { favoriteRepository } from "@/services/repositories/favoriteRepository";
import { commentRepository } from "@/services/repositories/commentRepository";
import type { EngagementStats } from "@/types";

/**
 * GET /api/ads/stats
 *   Returns engagement stats for a batch of ads.
 *
 * Response format:
 * {
 *   stats: {
 *     "<adId>": { adId, views, reactions, comments, favorites, viewerHasFavorited }
 *   }
 * }
 *
 * Always returns a valid stats object — never null/undefined.
 */

export async function GET(request: NextRequest) {
  try {
    const adIds = request.nextUrl.searchParams.get("ids")?.split(",") ?? [];
    const viewerId = request.nextUrl.searchParams.get("viewerId");

    // Default empty stats object
    const defaultStats: Record<string, EngagementStats> = {};

    if (!adIds.length || adIds[0] === "") {
      return NextResponse.json({ stats: defaultStats });
    }

    const statsList = await Promise.all(
      adIds.filter(Boolean).map(async (id) => {
        const [reactionSummary, favCount, commentCount, isFavorited] = await Promise.all([
          reactionRepository.getSummary(id, viewerId || null),
          favoriteRepository.countByAd(id),
          commentRepository.countByAd(id),
          viewerId
            ? favoriteRepository.isFavorited(id, viewerId)
            : Promise.resolve(false),
        ]);

        return {
          adId: id,
          views: 0,
          reactions: reactionSummary.total,
          comments: commentCount,
          favorites: favCount,
          viewerHasFavorited: isFavorited,
        } satisfies EngagementStats;
      }),
    );

    // Convert array to record keyed by adId
    const statsRecord: Record<string, EngagementStats> = {};
    for (const stat of statsList) {
      statsRecord[stat.adId] = stat;
    }

    return NextResponse.json({ stats: statsRecord });
  } catch {
    // Return default empty stats on error
    return NextResponse.json({ stats: {} });
  }
}
