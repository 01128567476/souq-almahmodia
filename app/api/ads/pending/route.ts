import { NextResponse } from "next/server";
import { adRepository } from "@/services/repositories/adRepository";
import { getCurrentUser, isAdmin } from "@/lib/serverAuth";

/**
 * GET /api/ads/pending
 *
 * Admin-only endpoint. Returns ads awaiting review.
 *
 * SECURITY: Requires authenticated admin session.
 */
export async function GET() {
  try {
    // Authentication check
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Authorization check — admin only
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const ads = await adRepository.listPending();
    return NextResponse.json(ads);
  } catch (error) {
    console.error("[ADS_PENDING_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch pending ads" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";