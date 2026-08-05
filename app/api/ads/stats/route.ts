import { NextRequest, NextResponse } from "next/server";
import { reactionRepository } from "@/services/repositories/reactionRepository";
import { favoriteRepository } from "@/services/repositories/favoriteRepository";
import { commentRepository } from "@/services/repositories/commentRepository";
import type { EngagementStats } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const adIds = request.nextUrl.searchParams.get("ids")?.split(",") ?? [];
    const viewerId = request.nextUrl.searchParams.get("viewerId");

    if (!adIds.length || adIds[0] === "") {
      return NextResponse.json({ success: true, data: [] });
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

    return NextResponse.json({ success: true, data: statsList });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 },
    );
  }
}