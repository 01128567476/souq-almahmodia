import { Icon } from "@/components/ui/Icon";
import { cn } from "@/utils/cn";
import type { AppNotification } from "@/types";

/** Icon per notification type, covering both dashboard and user (ad) events. */
const typeIcon: Record<AppNotification["type"], string> = {
  report: "flag",
  system: "settings",
  ad_approved: "check_circle",
  ad_rejected: "cancel",
  ad_expired: "schedule",
};

/** Accent colour for the icon chip; unread items also tint their whole row. */
const typeTone: Record<AppNotification["type"], string> = {
  report: "text-error",
  system: "text-on-surface-variant",
  ad_approved: "text-green-700",
  ad_rejected: "text-error",
  ad_expired: "text-amber-700",
};

export function NotificationItem({ notification }: { notification: AppNotification }) {
  const n = notification;
  return (
    <li
      className={cn(
        "flex items-start gap-md rounded-2xl border p-md",
        n.read
          ? "border-outline-variant bg-surface-container-lowest"
          : "border-primary/30 bg-primary-fixed/40",
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-full bg-surface-container flex items-center justify-center shrink-0",
          typeTone[n.type],
        )}
      >
        <Icon name={typeIcon[n.type]} size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-sm">
          <p className="font-medium text-on-surface">{n.title}</p>
          <span className="text-label-md font-label-md text-on-surface-variant shrink-0">
            {n.time}
          </span>
        </div>
        <p className="text-body-sm font-body-sm text-on-surface-variant mt-xs">{n.body}</p>
      </div>
      {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
    </li>
  );
}
