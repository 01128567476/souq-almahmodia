/**
 * GET /api/ads/[id]/reactions
 *   Returns aggregate reaction summary for an ad.
 *
 * POST /api/ads/[id]/reactions
 *   Sets or updates the viewer's reaction on an ad.
 *
 * Production-only. No mock data. No temporary code.
 * User identity derived from Auth.js session.
 */

import { NextRequest, NextResponse } from "next/server";
import { reactionRepository } from "@/services/repositories/reactionRepository";
import { getCurrentUser } from "@/lib/serverAuth";
import type { ReactionType } from "@/types";

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

    const summary = await reactionRepository.getSummary(id, viewerId || null);

    return NextResponse.json({ success: true, data: summary });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch reactions" },
      { status: 500 },
    );
  }
}

/* -------------------------------------------------------------------------- */
/* POST — Set or update reaction                                              */
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

    const body = await request.json();
    const type = body.type as ReactionType | undefined;

    if (!type) {
      return NextResponse.json(
        { success: false, error: "Missing reaction type" },
        { status: 400 },
      );
    }

    // Validate type is a known reaction type
    const validTypes: ReactionType[] = ["like", "love", "funny", "wow", "sad"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: "Invalid reaction type" },
        { status: 400 },
      );
    }

    await reactionRepository.upsert({ adId: id, userId: currentUser.id, type });
    const summary = await reactionRepository.getSummary(id, currentUser.id);

    return NextResponse.json({ success: true, data: summary });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to set reaction" },
      { status: 500 },
    );
  }
}