import { setRequestLocale, getTranslations } from "next-intl/server";
import { adRepository } from "@/services/repositories/adRepository";
import { reportRepository } from "@/services/repositories/reportRepository";
import { userRepository } from "@/services/repositories/userRepository";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { UsersView } from "@/components/dashboard/UsersView";
import type { Locale } from "@/i18n/routing";

export default async function UsersPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const [users, ads, reports] = await Promise.all([
    userRepository.list(),
    adRepository.list(),
    reportRepository.listOpenReports(),
  ]);

  const adsByOwner = new Map<string, string[]>();
  for (const ad of ads) {
    if (!ad.ownerId) continue;
    const ownerAds = adsByOwner.get(ad.ownerId) ?? [];
    ownerAds.push(ad.id);
    adsByOwner.set(ad.ownerId, ownerAds);
  }

  const reportsByOwner = new Map<string, number>();
  for (const report of reports) {
    const ownerId = ads.find((ad) => ad.id === report.adId)?.ownerId;
    if (!ownerId) continue;
    reportsByOwner.set(ownerId, (reportsByOwner.get(ownerId) ?? 0) + 1);
  }

  const usersWithReportCount = users.map((user) => ({
    ...user,
    reportsCount: reportsByOwner.get(user.id) ?? 0,
    adsCount: adsByOwner.get(user.id)?.length ?? user.adsCount,
  }));

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title={t("users.title")} subtitle={t("users.subtitle")} />
      <UsersView initialUsers={usersWithReportCount} />
    </div>
  );
}
