"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotificationItem } from "@/components/ui/NotificationItem";
import { MarkAllReadButton } from "@/components/dashboard/MarkAllReadButton";
import type { AppNotification } from "@/types";

async function fetchNotifications(): Promise<AppNotification[]> {
  try {
    const res = await fetch("/api/notifications");
    if (!res.ok) return [];
    const data = await res.json();
    return data.notifications ?? [];
  } catch {
    return [];
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    fetchNotifications().then((initial) => {
      setNotifications(initial);
    });
  }, []);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="مركز الإشعارات"
        subtitle="تابع كل ما يحدث في سوق المحمودية."
        actions={
          <MarkAllReadButton onSuccess={handleMarkAllRead} />
        }
      />

      {notifications.length === 0 ? (
        <EmptyState icon="notifications_off" title="لا توجد إشعارات" />
      ) : (
        <ul className="space-y-sm">
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} />
          ))}
        </ul>
      )}
    </div>
  );
}