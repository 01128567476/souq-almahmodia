/**
 * POST /api/ads/[id]/report
 *
 * Submit a report on an advertisement.
 *
 * Production-only. No mock data. No temporary code.
 * Authentication: Auth.js session via getCurrentUser().
 * Validation: prevents self-reports and duplicate reports.
 */

import { NextRequest, NextResponse } from "next/server";
import { reportRepository } from "@/services/repositories/reportRepository";
import { getCurrentUser } from "@/lib/serverAuth";
import type { ReportReason } from "@/types";

/* -------------------------------------------------------------------------- */
/* POST — Submit a report                                                     */
/* -------------------------------------------------------------------------- */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;

    // Authenticate via Auth.js session
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const reason = body.reason as ReportReason | undefined;
    const description = typeof body.description === "string" ? body.description : undefined;

    if (!reason) {
      return NextResponse.json(
        { success: false, error: "Missing report reason" },
        { status: 400 },
      );
    }

    // Validate reason is a known value
    const validReasons: ReportReason[] = [
      "spam",
      "prohibited",
      "counterfeit",
      "offensive",
      "misleading",
      "wrong_category",
      "other",
    ];
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { success: false, error: "Invalid report reason" },
        { status: 400 },
      );
    }

    // Map reason to severity
    const severityMap: Record<ReportReason, "low" | "medium" | "high"> = {
      spam: "low",
      wrong_category: "low",
      other: "medium",
      misleading: "medium",
      offensive: "medium",
      prohibited: "high",
      counterfeit: "high",
    };

    const report = await reportRepository.create({
      adId: id,
      reporterId: currentUser.id,
      reporterName: currentUser.name,
      reason,
      description,
      severity: severityMap[reason],
    });

    return NextResponse.json({ success: true, data: report }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.message === "Ad not found" || error.message === "Cannot report your own ad" || error.message === "You have already reported this ad")) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 },
      );
    }
    console.error("[report-api] Failed to create report:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit report" },
      { status: 500 },
    );
  }
}