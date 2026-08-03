import { NextResponse } from "next/server";
import { runExpiryCleanup, countExpiredAds } from "@/services/repositories/adRepository";

/**
 * Scheduled Expiry Cleanup API
 *
 * POST /api/ads/expiry - Runs the scheduled cleanup job 
 * GET /api/ads/expiry - Returns count of expired ads (read-only)
 *
 * SCHEDULING NOTE:
 * Do NOT use setInterval or any in-process scheduler.
 * The cleanup job MUST be triggered by an external scheduler:
 *   - Linux Cron (crontab entry calling curl/wget)
 *   - Vercel Cron (vercel.json "crons" configuration)
 *   - GCP Cloud Scheduler (Cloud Run job on a 3-day schedule)
 *   - AWS EventBridge (Lambda triggering this endpoint)
 *   - Kubernetes CronJob (declarative pod spec)
 *
 * The repository layer (runExpiryCleanup) is a PURE FUNCTION.
 * It has no side effects beyond data mutation and knows nothing
 * about scheduling, timers, or HTTP.
 */

export async function POST() {
  try {
    const result = await runExpiryCleanup();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ads/expiry
 *
 * Read-only check - how many ads are currently expired (not yet cleaned up).
 * Does NOT modify any data.
 */
export async function GET() {
  try {
    const count = await countExpiredAds();
    return NextResponse.json({ expired: count });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Count failed" },
      { status: 500 }
    );
  }
}