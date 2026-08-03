import { NextResponse } from "next/server";
import { notificationRepository } from "@/services/repositories/notificationRepository";
import { getCurrentUser } from "@/lib/serverAuth";

/**
 * POST /api/notifications/mark-all-read
 *
 * Mark ALL notifications as read (admin use case).
 * Called when admin clicks "Mark All Read" button on admin notifications page.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const count = await notificationRepository.markAllAsReadAll();
    return NextResponse.json({ success: true, markedCount: count });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to mark notifications as read" },
      { status: 500 },
    );
  }
}