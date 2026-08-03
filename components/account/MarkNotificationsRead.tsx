"use client";

import { useEffect } from "react";

/**
 * Auto-mark all notifications as read when mounted.
 * Called automatically when the user opens the notifications page.
 */
export function MarkNotificationsRead() {
  useEffect(() => {
    async function markAsRead() {
      try {
        await fetch("/api/notifications/read", { method: "POST" });
      } catch {
        // Silently fail — non-critical UX improvement
      }
    }
    markAsRead();
  }, []);

  // This component renders nothing visible
  return null;
}