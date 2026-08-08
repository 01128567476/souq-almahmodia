/**
 * GET /api/cleanup-unverified
 *
 * Scheduled cleanup job that deletes unverified user accounts.
 *
 * PROTECTED ENDPOINT — requires internal cron secret header.
 * 
 * Security:
 * - X-Cron-Secret header must match CRON_SECRET env var
 * - If CRON_SECRET not set, endpoint returns 501 (disabled)
 * - Never accessible from browser (no cookie-based auth bypass)
 *
 * Deletes users where:
 * - emailVerified IS NULL (never verified their email)
 * - createdAt older than 24 hours
 * - googleId IS NULL (never linked Google account)
 * - hasPassword = false (never created a password)
 *
 * Query parameters:
 * - dryRun=true — Show what would be deleted without deleting
 *
 * SAFETY:
 * - NEVER deletes verified users
 * - NEVER deletes Google users
 * - NEVER deletes users with passwords
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-server";
import { users } from "@/drizzle/schema";
import { eq, and, isNull, lt } from "drizzle-orm";

/** Verify the cron secret header. Returns true if authorized. */
function verifyCronSecret(request: NextRequest): boolean {
  const secret = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;

  // If no CRON_SECRET configured, disable the endpoint
  if (!expected) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  if (!secret) return false;
  
  const secretBytes = new TextEncoder().encode(secret);
  const expectedBytes = new TextEncoder().encode(expected);
  
  if (secretBytes.length !== expectedBytes.length) return false;
  
  let result = 0;
  for (let i = 0; i < secretBytes.length; i++) {
    result |= secretBytes[i] ^ expectedBytes[i];
  }
  
  return result === 0;
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret — this is NOT a cookie/auth session check
    if (!verifyCronSecret(request)) {
      return NextResponse.json(
        { error: "Unauthorized: valid cron secret required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") === "true";

    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    // Find unverified registrations using Drizzle ORM (NO raw SQL)
    const unverifiedUsers = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        and(
          isNull(users.emailVerified),
          lt(users.createdAt, cutoffTime),
          isNull(users.googleId),
          eq(users.hasPassword, false)
        )
      );

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        count: unverifiedUsers.length,
        users: unverifiedUsers,
        message: `Found ${unverifiedUsers.length} unverified users to clean up (dry run).`,
      });
    }

    // Delete them using Drizzle ORM parameterized query (NO raw SQL injection risk)
    if (unverifiedUsers.length > 0) {
      const userIds = unverifiedUsers.map((u) => u.id);
      await db
        .delete(users)
        .where(
          and(
            ...userIds.map((id) => eq(users.id, id))
          )
        );
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      deletedCount: unverifiedUsers.length,
      message: `Successfully cleaned up ${unverifiedUsers.length} unverified user(s).`,
    });
  } catch (error) {
    console.error("[CLEANUP_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Cleanup failed" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";