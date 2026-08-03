"use client";

import { ReactionBar } from "@/components/engagement/ReactionBar";
import { CommentsSection } from "@/components/engagement/CommentsSection";
import { useReactions } from "@/hooks/useReactions";

/**
 * Engagement block shown below an advertisement's details: the reaction bar and
 * the full comments thread (with its count). Reaction state is owned here via
 * `useReactions` so the bar stays the single source of truth.
 */
export function AdEngagementPanel({
  adId,
  advertisement,
}: {
  adId: string;
  /** The owning ad, threaded to comments for delete permission checks. */
  advertisement?: { ownerId?: string } | null;
}) {
  const { summary, react, pending, isAuthenticated } = useReactions(adId);

  return (
    <div className="mt-2xl border-t border-outline-variant pt-xl">
      <ReactionBar
        adId={adId}
        summary={summary}
        onReact={react}
        pending={pending}
        isAuthenticated={isAuthenticated}
      />
      <CommentsSection adId={adId} advertisement={advertisement} />
    </div>
  );
}
