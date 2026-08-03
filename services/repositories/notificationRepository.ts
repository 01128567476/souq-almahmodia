/**
 * Notification repository — Drizzle ORM implementation.
 *
 * Replaces mockDb with PostgreSQL via Drizzle ORM.
 *
 * Public interface remains EXACTLY the same.
 */

import type { AppNotification } from "@/types";
import { db } from "@/lib/db-server";
import { notifications } from "@/drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { clone } from "@/lib/db-utils";

/* -------------------------------------------------------------------------- */
/* Input types                                                                */
/* -------------------------------------------------------------------------- */

interface NotificationInput extends Omit<AppNotification, "id" | "time" | "createdAt"> {
  recipientId?: string;
}

/* -------------------------------------------------------------------------- */
/* Repository                                                                 */
/* -------------------------------------------------------------------------- */

export const notificationRepository = {
  /**
   * List notifications for a user (newest first).
   */
  async listForUser(userId: string): Promise<AppNotification[]> {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, userId))
      .orderBy(desc(notifications.createdAt));

    const result: AppNotification[] = rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      time: row.time ?? "",
      read: row.read,
      recipientId: row.recipientId,
      adId: row.adId ?? undefined,
      createdAt: row.createdAt.toISOString(),
    }));

    return clone(result);
  },

  /**
   * Mark all notifications for a user as read.
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.recipientId, userId),
          eq(notifications.read, false),
        ),
      )
      .returning({ count: sql<number>`COUNT(*)` });

    return Number(result[0]?.count ?? 0);
  },

  /**
   * Mark ALL notifications as read (admin use case).
   */
  async markAllAsReadAll(): Promise<number> {
    const result = await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.read, false))
      .returning({ count: sql<number>`COUNT(*)` });

    return Number(result[0]?.count ?? 0);
  },

  /**
   * Add a new notification.
   */
  async add(notification: NotificationInput): Promise<AppNotification> {
    const now = new Date();
    const time = now.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });

    await db
      .insert(notifications)
      .values({
        type: notification.type,
        title: notification.title,
        body: notification.body,
        time,
        read: false,
        recipientId: notification.recipientId ?? "",
        adId: notification.adId ?? null,
        createdAt: now,
      });

    const row = await db
      .select()
      .from(notifications)
      .where(eq(notifications.createdAt, now))
      .orderBy(desc(notifications.createdAt))
      .limit(1);

    const result: AppNotification = {
      id: row[0].id,
      type: row[0].type,
      title: row[0].title,
      body: row[0].body,
      time,
      read: false,
      recipientId: row[0].recipientId,
      adId: row[0].adId ?? undefined,
      createdAt: row[0].createdAt.toISOString(),
    };

    return clone(result);
  },

  /**
   * Delete a notification (for cleanup when ad expires/is deleted).
   */
  async deleteByAdId(adId: string): Promise<number> {
    const result = await db
      .delete(notifications)
      .where(eq(notifications.adId, adId))
      .returning({ count: sql<number>`COUNT(*)` });

    return Number(result[0]?.count ?? 0);
  },

  /**
   * List all notifications (admin dashboard).
   */
  async listAll(): Promise<AppNotification[]> {
    const rows = await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt));

    const result: AppNotification[] = rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      time: row.time ?? "",
      read: row.read,
      recipientId: row.recipientId,
      adId: row.adId ?? undefined,
      createdAt: row.createdAt.toISOString(),
    }));

    return clone(result);
  },
};