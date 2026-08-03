"use client";

import { useState } from "react";

/**
 * Client component that calls the API to mark ALL notifications as read.
 * Used on the admin notifications page.
 */
export function MarkAllReadButton({ onSuccess }: { onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);

  async function handleMarkAllRead() {
    setLoading(true);
    try {
      await fetch("/api/notifications/mark-all-read", { method: "POST" });
      onSuccess?.();
    } catch {
      // Silently fail — non-critical UX improvement
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleMarkAllRead}
      disabled={loading}
      className="text-primary font-label-md text-label-md hover:underline disabled:opacity-50"
    >
      {loading ? "جاري التحديث..." : "تحديد الكل كمقروء"}
    </button>
  );
}