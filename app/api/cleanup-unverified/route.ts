/**
 * GET /api/cleanup-unverified
 *
 * Scheduled cleanup job that deletes unverified user accounts.
 *
 * Deletes users where:
 * - emailVerified IS NULL (never verified their email)
 * - createdAt older than 24 hours
 * - googleId IS NULL (never linked Google account)
 * - hasPassword = false (never created a password)
 *
 * This is a PROTECTED admin-only endpoint.
 * Call this via cron job or manual trigger.
 *
 * Query parameters:
 * 
 - dryRun=true — Show what would be deleted without deleting
 * * NOT CHANGE:
 * - NEVER deletes verified users
 * - NEVER deletes Google users
 * - NEVER deletes users with passwords
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-server";
import { users } from "@/drizzle/schema";
import { eq, and, isNull, lt, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") === "true";

    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    // Find unverified registrations
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

    // Delete them
    if (unverifiedUsers.length > 0) {
      const userIds = unverifiedUsers.map((u) => u.id);
      await db
        .delete(users)
        .where(sql`id IN (${userIds.map((id) => sql`${id}`).reduce((a, b, i) => i === 0 ? b : sql`${a}, ${b}`).toString()})`);
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