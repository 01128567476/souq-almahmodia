/**
 * Report repository - Drizzle ORM implementation.
 *
 * Production-grade: uses database-level unique constraint to prevent
 * duplicate reports. No SELECT-then-INSERT race conditions.
 *
 * Public interface remains EXACTLY the same.
 */

import type { AdReport } from "@/types";
import { db } from "@/lib/db-server";
import { reports, products } from "@/drizzle/schema";
import { eq, and, count, sql, inArray } from "drizzle-orm";
import { clone } from "@/lib/db-utils";
import { desc } from "drizzle-orm";

/* -------------------------------------------------------------------------- */
/* Input types                                                                */
/* -------------------------------------------------------------------------- */

export interface CreateReportInput {
  adId: string;
  reporterId: string;
  reporterName: string;
  reason: "spam" | "prohibited" | "counterfeit" | "offensive" | "misleading" | "wrong_category" | "other";
  description?: string;
  severity: "low" | "medium" | "high";
}

/* -------------------------------------------------------------------------- */
/* Repository                                                                 */
/* -------------------------------------------------------------------------- */

export const reportRepository = {
  /**
   * Create a new report on an ad - production-safe.
   *
   * Constraints enforced at repository level:
   * - No self-reports: reporterId cannot own the ad.
   * - No duplicates: database-level unique constraint on (adId, reporterId)
   *   where status != 'resolved' prevents duplicate open reports.
   *
   * Uses constraint violation detection to prevent race conditions.
   */
  async create(input: CreateReportInput): Promise<AdReport> {
    // Fetch the ad to get the owner for self-report check
    const adRow = await db
      .select()
      .from(products)
      .where(eq(products.id, input.adId))
      .limit(1);

    if (adRow.length === 0) {
      throw new Error("Ad not found");
    }

    // Prevent self-reports
    if (adRow[0].ownerId === input.reporterId) {
      throw new Error("Cannot report your own ad");    

    }

    const now = new Date();
    // Try to insert - if a non-resolved report already exists, the
    // database unique constraint will prevent the duplicate.
    // Catch the constraint violation and return a meaningful error.
    try {
      const result = await db
        .insert(reports)
        .values({
          adId: input.adId,
          reporterId: input.reporterId,
          reporterName: input.reporterName,
          reason: input.reason,
          description: input.description ?? null,
          severity: input.severity,
          status: "open",
          createdAt: now,
        })
        .returning();

      const row = result[0];
      return {
        id: row.id,
        adId: row.adId,
        reporterId: row.reporterId,
        reporterName: row.reporterName,
        reason: row.reason,
        description: row.description ?? undefined,
        severity: row.severity,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      };
    } catch (err) {
      // Check if it's a unique constraint violation (PostgreSQL error code 23505)
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes("23505") || errorMsg.includes("unique_constraint") || errorMsg.includes("duplicate")) {
        throw new Error("You have already reported this ad");
      }
      // Re-throw unexpected errors
      throw err;
    }
  },

  /**
   * List all reports for a specific ad.
   */
  async listByAdId(adId: string): Promise<AdReport[]> {
    const rows = await db
      .select()
      .from(reports)
      .where(eq(reports.adId, adId))
      .orderBy(desc(reports.createdAt));

    const result: AdReport[] = rows.map((row) => ({
      id: row.id,
      adId: row.adId,
      reporterId: row.reporterId,
      reporterName: row.reporterName,
      reason: row.reason,
      description: row.description ?? undefined,
      severity: row.severity,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }));

    return clone(result);
  },

  /**
   * List all reports for a batch of ad IDs.
   */
  async listByAdIds(adIds: string[]): Promise<AdReport[]> {
    if (adIds.length === 0) return [];

    const rows = await db
      .select()
      .from(reports)
      .where(
        inArray(reports.adId, adIds)
      )
      .orderBy(desc(reports.createdAt));

    const result: AdReport[] = rows.map((row) => ({
      id: row.id,
      adId: row.adId,
      reporterId: row.reporterId,
      reporterName: row.reporterName,
      reason: row.reason,
      description: row.description ?? undefined,
      severity: row.severity,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }));

    return clone(result);
  },

  /**
   * Resolve all open reports for an ad.
   */
  async resolveReportsByAdId(adId: string): Promise<AdReport[]> {
    await db
      .update(reports)
      .set({ status: "resolved" })
      .where(
        and(
          eq(reports.adId, adId),
          sql`${reports.status} != 'resolved'`,
        ),
      );

    const rows = await db
      .select()
      .from(reports)
      .where(eq(reports.adId, adId))
      .orderBy(desc(reports.createdAt));

    const result: AdReport[] = rows.map((row) => ({
      id: row.id,
      adId: row.adId,
      reporterId: row.reporterId,
      reporterName: row.reporterName,
      reason: row.reason,
      description: row.description ?? undefined,
      severity: row.severity,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }));

    return clone(result);
  },

  /**
   * List all open (unresolved) reports across all ads.
   */
  async listOpenReports(): Promise<AdReport[]> {
    const rows = await db
      .select()
      .from(reports)
      .where(sql`${reports.status} != 'resolved'`)
      .orderBy(desc(reports.createdAt));

    const result: AdReport[] = rows.map((row) => ({
      id: row.id,
      adId: row.adId,
      reporterId: row.reporterId,
      reporterName: row.reporterName,
      reason: row.reason,
      description: row.description ?? undefined,
      severity: row.severity,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }));

    return clone(result);
  },

  /**
   * List all reports (for dashboard).
   */
  async list(): Promise<AdReport[]> {
    const rows = await db
      .select()
      .from(reports)
      .orderBy(desc(reports.createdAt));

    const result: AdReport[] = rows.map((row) => ({
      id: row.id,
      adId: row.adId,
      reporterId: row.reporterId,
      reporterName: row.reporterName,
      reason: row.reason,
      description: row.description ?? undefined,
      severity: row.severity,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }));

    return clone(result);
  },

  /**
   * Count open (unresolved) reports.
   */
  async countOpen(): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(reports)
      .where(sql`${reports.status} != 'resolved'`);

    return Number(result[0]?.count ?? 0);
  },
};