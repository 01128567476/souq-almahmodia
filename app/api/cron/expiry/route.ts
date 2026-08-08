/**
 * POST /api/cron/expiry
 *
 * Cron-protected endpoint for ad expiry cleanup.
 * Runs daily at midnight (UTC) via Vercel Cron.
 *
 * AUTHENTICATION: Requires X-Cron-Secret header matching CRON_SECRET env var.
 *
 * BEHAVIOR:
 * - Finds all ads where expiresAt <= NOW() AND status != 'deleted'
 * - Sets their status to 'deleted'
 * - Deletes related notifications of type 'ad_expired'
 *
 * This endpoint is SAFE to be publicly accessible because:
 * 1. It requires a valid CRON_SECRET header
 * 2. It only performs safe status transitions
 * 3. It runs on a cron schedule (not user-triggered)
 */

import { NextResponse } from "next/server";
import { runExpiryCleanup } from "@/services/repositories/adRepository";

export async function POST(request: Request) {
  try {
    // Verify cron secret via Authorization header (Bearer token)
    const authHeader = request.headers.get("authorization") ?? "";
    const secret = authHeader.replace("Bearer ", "");
    if (!secret || secret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Run expiry cleanup
    const result = await runExpiryCleanup();

    return NextResponse.json({
      success: true,
      expired: result.expired,
      deleted: result.deleted,
      message: `Cleaned up ${result.expired} expired ads`,
    });
  } catch (error) {
    console.error("[CRON_EXPIRY_ERROR]", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;