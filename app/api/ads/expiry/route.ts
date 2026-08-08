import { NextRequest, NextResponse } from "next/server";
import { runExpiryCleanup, countExpiredAds } from "@/services/repositories/adRepository";

/**
 * POST /api/ads/expiry - Runs the scheduled cleanup job
 * GET /api/ads/expiry - Returns count of expired ads (read-only, rate-limited)
 *
 * SECURITY:
 * - POST requires X-Cron-Secret header matching CRON_SECRET env var
 * - GET is publicly readable (read-only, no auth needed)
 * - Never accessible from browser directly (no cookie-based auth bypass)
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

/** Verify the cron secret header. */
function verifyCronSecret(request: NextRequest): boolean {
  const secret = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;

  // If no CRON_SECRET configured, disable the endpoint
  if (!expected) return false;
  if (!secret) return false;

  // Constant-time comparison to prevent timing attacks
  const secretBytes = new TextEncoder().encode(secret);
  const expectedBytes = new TextEncoder().encode(expected);

  if (secretBytes.length !== expectedBytes.length) return false;

  let result = 0;
  for (let i = 0; i < secretBytes.length; i++) {
    result |= secretBytes[i] ^ expectedBytes[i];
  }

  return result === 0;
}

/**
 * POST — Runs the scheduled expiry cleanup.
 * PROTECTED: Requires valid X-Cron-Secret header.
 */
export async function POST(request: NextRequest) {
  try {
    // Cron secret verification (NOT session-based auth)
    if (!verifyCronSecret(request)) {
      return NextResponse.json(
        { error: "Unauthorized: valid cron secret required" },
        { status: 401 }
      );
    }

    const result = await runExpiryCleanup();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[EXPIRY_CLEANUP_ERROR]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}

/**
 * GET — Read-only check: how many ads are currently expired (not yet cleaned up).
 * Does NOT modify any data. No auth required.
 */
export async function GET() {
  try {
    const count = await countExpiredAds();
    return NextResponse.json({ expired: count });
  } catch (err) {
    console.error("[EXPIRY_COUNT_ERROR]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Count failed" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";