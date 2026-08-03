import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth";
import { notificationRepository } from "@/services/repositories/notificationRepository";
import type { AppNotification } from "@/types";
import { parsePagination, buildPaginationMeta, type PaginatedResponse } from "@/lib/pagination";

/**
 * GET /api/notifications
 *   Fetch paginated notifications for the authenticated user.
 *   Authentication: Auth.js session via getCurrentUser().
 *   userId is ALWAYS derived from the session — never from the client.
 *   Query params: page, limit
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { page, limit } = parsePagination(Object.fromEntries(url.searchParams.entries()));
    const offset = (page - 1) * limit;

    // Authenticate via Auth.js session
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "auth.required" }, { status: 401 });
    }
    const userId = currentUser.id;
    if (!userId) {
      return NextResponse.json({ error: "auth.required" }, { status: 401 });
    }

    // Load notifications from DB via repository
    const rawNotifications = await notificationRepository.listForUser(userId);

    // Manual pagination (repository doesn't support offset yet)
    const total = rawNotifications.length;
    const paginatedNotifications = rawNotifications.slice(offset, offset + limit);
    const meta = buildPaginationMeta({ page, limit }, total);

    // Map DB rows to AppNotification format
    const notifications: AppNotification[] = paginatedNotifications.map((row: any) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.message,
      time: row.createdAt?.toISOString() ?? new Date().toISOString(),
      read: row.isRead ?? false,
      recipientId: row.recipientId,
      adId: row.adId,
      createdAt: row.createdAt?.toISOString() ?? undefined,
    }));

    const response: PaginatedResponse<AppNotification> = {
      data: notifications,
      meta,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[Notifications API Error]", err);
    return NextResponse.json(
      { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false } },
      { status: 200 },
    );
  }
}
