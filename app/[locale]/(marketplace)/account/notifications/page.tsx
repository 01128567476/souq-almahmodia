import { setRequestLocale, getTranslations } from "next-intl/server";
import { getUserNotifications } from "@/services/dashboard";
import { NotificationItem } from "@/components/ui/NotificationItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarkNotificationsRead } from "@/components/account/MarkNotificationsRead";
import type { Locale } from "@/i18n/routing";

export default async function AccountNotificationsPage({ 
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("userNotifications");

  const notifications = await getUserNotifications();

  return (
    <div>
      {/* Auto-mark all notifications as read when page loads */}
      <MarkNotificationsRead />

      <header className="mb-xl">
        <h2 className="text-headline-md font-headline-md text-on-surface">{t("title")}</h2>
        <p className="text-body-md font-body-md text-on-surface-variant mt-xs">{t("subtitle")}</p>
      </header>

      {notifications.length === 0 ? (
        <EmptyState icon="notifications_off" title={t("empty")} />
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
