/**
 * Engagement facade — client-safe stub.
 *
 * This file does NOT statically import any repositories (they import pg).
 * All methods use dynamic imports so the repositories are code-split away
 * from the client bundle.
 */

import type {
  EngagementStats,
  ReactionType,
  ReactionSummary,
} from "@/types";

/* -------------------------------------------------------------------------- */
/* Reactions — delegates entirely to reactionRepository                        */
/* -------------------------------------------------------------------------- */

export const engagementService = {
  /* Reactions ------------------------------------------------------------- */

  /** Get aggregate reaction summary for an ad. */
  async getReactions(adId: string, viewerId: string | null): Promise<ReactionSummary> {
    const { reactionRepository } = await import("@/services/repositories/reactionRepository");
    return reactionRepository.getSummary(adId, viewerId);
  },

  /** Set or change the viewer's reaction. */
  async setReaction(
    adId: string,
    viewerId: string,
    type: ReactionType,
  ): Promise<ReactionSummary> {
    const { reactionRepository } = await import("@/services/repositories/reactionRepository");
    await reactionRepository.upsert({ adId, userId: viewerId, type });
    return this.getReactions(adId, viewerId);
  },

  /** Remove the viewer's reaction if present. */
  async removeReaction(adId: string, viewerId: string): Promise<ReactionSummary> {
    const { reactionRepository } = await import("@/services/repositories/reactionRepository");
    await reactionRepository.remove(adId, viewerId);
    return this.getReactions(adId, viewerId);
  },

  /* Analytics ------------------------------------------------------------- */

  /** Get engagement stats for a single ad. */
  async getStats(adId: string, viewerId: string | null = null): Promise<EngagementStats> {
    const [
      reactionMod,
      favoriteMod,
      commentMod,
    ] = await Promise.all([
      import("@/services/repositories/reactionRepository"),
      import("@/services/repositories/favoriteRepository"),
      import("@/services/repositories/commentRepository"),
    ]);

    const [reactionSummary, favCount, commentCount, isFavorited] = await Promise.all([
      reactionMod.reactionRepository.getSummary(adId, viewerId),
      favoriteMod.favoriteRepository.countByAd(adId),
      commentMod.commentRepository.countByAd(adId),
      viewerId ? favoriteMod.favoriteRepository.isFavorited(adId, viewerId) : Promise.resolve(false),
    ]);

    return {
      adId,
      views: 0,
      reactions: reactionSummary.total,
      comments: commentCount,
      favorites: favCount,
      viewerHasFavorited: isFavorited,
    };
  },

  /** Fetch stats for many ads at once. */
  async getStatsBatch(
    adIds: string[],
    viewerId: string | null = null,
  ): Promise<Record<string, EngagementStats>> {
    const result: Record<string, EngagementStats> = {};
    for (const adId of adIds) {
      result[adId] = await this.getStats(adId, viewerId);
    }
    return result;
  },

  /* Favorites ------------------------------------------------------------- */

  /** Add the ad to the viewer's favorites. */
  async addFavorite(adId: string, viewerId: string): Promise<EngagementStats> {
    const { favoriteRepository } = await import("@/services/repositories/favoriteRepository");
    await favoriteRepository.add({ userId: viewerId, adId });
    return this.getStats(adId, viewerId);
  },

  /** Remove the ad from the viewer's favorites. */
  async removeFavorite(adId: string, viewerId: string): Promise<EngagementStats> {
    const { favoriteRepository } = await import("@/services/repositories/favoriteRepository");
    await favoriteRepository.remove(adId, viewerId);
    return this.getStats(adId, viewerId);
  },

  /** Record a view (fire-and-forget). Views are not yet tracked in any repository. */
  async recordView(adId: string): Promise<void> {
    // TODO: Add viewRepository when view tracking is needed.
  },
};