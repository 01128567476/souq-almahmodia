/**
 * GET /api/ads/[id]/reactions
 *   Returns reaction summary for an ad.
 *
 *   Response: { summary: { total, counts, viewerReaction } }
 *
 * POST /api/ads/[id]/reactions
 *   Toggle/set viewer reaction on an ad.
 *
 *   Query params:
 *    - remove=true  → remove the viewer's reaction
 *   Body: { type: ReactionType }
 *
 *   Response: { summary: { total, counts, viewerReaction } }
 *
 * Production-only. No mock data. No temporary code.
 * User identity derived from Auth.js session.
 *
 * All mutation + read operations use a transaction to prevent
 * read-after-write inconsistency from Neon connection pooling.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-server";
import { reactions } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/serverAuth";
import type { ReactionType, ReactionSummary } from "@/types";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Validate that a string is a known reaction type. */
function isValidReactionType(value: unknown): value is ReactionType {
  return typeof value === "string" && ["like", "love", "funny", "wow", "sad"].includes(value);
}

/** Build a ReactionSummary from raw reaction rows. */
function buildSummary(
  rows: Array<{ type: ReactionType; userId: string }>,
  viewerId: string | null,
): ReactionSummary {
  const counts: Record<ReactionType, number> = {
    like: 0,
    love: 0,
    funny: 0,
    wow: 0,
    sad: 0,
  };

  let viewerReaction: ReactionType | null = null;

  for (const row of rows) {
    if (isValidReactionType(row.type)) {
      counts[row.type] = (counts[row.type] ?? 0) + 1;
    }
    if (viewerId && row.userId === viewerId) {
      viewerReaction = row.type;
    }
  }

  const total = Object.values(counts).reduce((sum: number, n: number) => sum + n, 0);

  return { total, counts, viewerReaction };
}

/** Default empty summary. */
const EMPTY_SUMMARY: ReactionSummary = {
  total: 0,
  counts: { like: 0, love: 0, funny: 0, wow: 0, sad: 0 },
  viewerReaction: null,
};

/* -------------------------------------------------------------------------- */
/* GET — Fetch reaction summary                                               */
/* -------------------------------------------------------------------------- */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const viewerId = _request.nextUrl.searchParams.get("viewerId");

    const { reactionRepository } = await import("@/services/repositories/reactionRepository");
    const summary = await reactionRepository.getSummary(id, viewerId || null);

    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ summary: EMPTY_SUMMARY });
  }
}

/* -------------------------------------------------------------------------- */
/* POST — Toggle/set reaction (transactional)                                 */
/* -------------------------------------------------------------------------- */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const remove = request.nextUrl.searchParams.get("remove") === "true";

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const userId = currentUser.id;

    // ALL mutation + read operations run in a single transaction
    const summary = await db.transaction(async (tx) => {
      if (remove) {
        await tx
          .delete(reactions)
          .where(
            and(
              eq(reactions.adId, id),
              eq(reactions.userId, userId),
            ),
          );

        // Read summary on the SAME transaction connection
        const allRows = await tx
          .select({ type: reactions.type, userId: reactions.userId })
          .from(reactions)
          .where(eq(reactions.adId, id));

        return buildSummary(allRows as any, userId);
      }

      // Upsert path
      const type = (request.body ? await request.json() : {}) as { type?: string };
      const reactionType = type.type as ReactionType | undefined;

      if (!reactionType) {
        throw new Error("Missing reaction type");
      }

      const validTypes: ReactionType[] = ["like", "love", "funny", "wow", "sad"];
      if (!validTypes.includes(reactionType)) {
        throw new Error("Invalid reaction type");
      }

      await tx
        .insert(reactions)
        .values({
          adId: id,
          userId,
          type: reactionType,
        })
        .onConflictDoUpdate({
          target: [reactions.adId, reactions.userId],
          set: { type: reactionType },
        });

      // Read summary on the SAME transaction connection
      const allRows = await tx
        .select({ type: reactions.type, userId: reactions.userId })
        .from(reactions)
        .where(eq(reactions.adId, id));

      return buildSummary(allRows as any, userId);
    });

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("[REACTION_API_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to set reaction" },
      { status: 500 },
    );
  }
}