import Image from "next/image";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getCurrentUser, getViewerRole } from "@/lib/serverAuth";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/i18n/routing";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const role = await getViewerRole();
  const user = await getCurrentUser();

  const metrics = [
    { icon: "task_alt", label: t("profile.resolvedReports"), value: "128" },
    { icon: "schedule", label: t("profile.responseTime"), value: "1.2h" },
    { icon: "star", label: t("profile.rating"), value: "4.9" },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title={t("profile.title")} />

      <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-xl flex flex-col sm:flex-row items-center sm:items-start gap-lg">
        {user && (
          <Image
            src={user.avatar || "/default-avatar.png"}
            alt=""
            width={96}
            height={96}
            className="rounded-2xl object-cover"
          />
        )}
        <div className="flex-1 text-center sm:text-start">
          <h2 className="text-headline-lg font-headline-lg text-on-surface">{user?.name}</h2>
          <p className="text-body-md font-body-md text-on-surface-variant mt-xs">{user?.email}</p>
          <p className="text-label-md font-label-md text-primary mt-sm">
            {t(`roles.${role}`)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-lg mt-xl">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg text-center"
          >
            <div className="w-12 h-12 mx-auto rounded-xl bg-primary-fixed text-primary flex items-center justify-center mb-md">
              <Icon name={m.icon} size={24} />
            </div>
            <p className="text-headline-lg font-headline-lg text-on-surface">{m.value}</p>
            <p className="text-body-sm font-body-sm text-on-surface-variant mt-xs">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}