import { NextRequest, NextResponse } from "next/server";
import { userRepository } from "@/services/repositories/userRepository";
import { adRepository } from "@/services/repositories/adRepository";
import type { Product, SearchResultUser } from "@/types";
import { safeDate } from "@/lib/dateUtils";

/**
 * GET /api/users/profile/[username]
 * Fetch a public user profile with their active ads.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await params;
    const normalized = username.trim().toLowerCase();

    // Look up user by username
    const userRow = await userRepository.getByUsername(normalized);
    if (!userRow) {
      return NextResponse.json({ error: "user.not_found" }, { status: 404 });
    }

    // Fetch user's active (approved, non-expired) ads only
    const allAds = await adRepository.listByOwner(userRow.id);
    const activeAds = allAds.filter((ad) => ad.status === "approved" && ad.expiresAt && new Date(ad.expiresAt).getTime() > Date.now());
    // Sort newest first
    activeAds.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    // Build the profile response (no private data exposed)
    const profile: SearchResultUser & { ads: Product[] } = {
      type: "user",
      id: userRow.id,
      displayName: userRow.displayName ?? "",
      username: userRow.username ?? "",
      avatar: userRow.avatar ?? "",
      adsCount: activeAds.length,
      joinedAt: safeDate(userRow.joinedAt, { fallback: "now" })!,
      score: 0, // not used for profile
      ads: activeAds,
    };

    return NextResponse.json({ profile });
  } catch (err) {
    console.error("[Profile API Error]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}