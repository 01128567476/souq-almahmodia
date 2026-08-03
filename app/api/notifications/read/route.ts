import { NextResponse } from "next/server";
import { notificationRepository } from "@/services/repositories/notificationRepository";
import { getCurrentUser } from "@/lib/serverAuth";

/**
 * POST /api/notifications/read
 *
 * Mark all notifications as read for the current user.
 * Called automatically when the user opens the notifications page.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const count = await notificationRepository.markAllAsRead(user.id);
    return NextResponse.json({ success: true, markedCount: count });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to mark notifications as read" },
      { status: 500 },
    );
  }
}