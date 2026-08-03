import { setRequestLocale, getTranslations } from "next-intl/server";
import { adRepository } from "@/services/repositories/adRepository";
import { categoryRepository } from "@/services/repositories/categoryRepository";
import { reportRepository } from "@/services/repositories/reportRepository";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ReportedAdsView } from "@/components/dashboard/ReportedAdsView";
import type { Locale } from "@/i18n/routing";

export default async function ReportedAdsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const [ads, categories] = await Promise.all([
    adRepository.listReported(),
    categoryRepository.list(),
  ]);

  const reportsByAdId: Record<string, import("@/types").AdReport[]> = {};
  await Promise.all(
    ads.map(async (ad) => {
      reportsByAdId[ad.id] = await reportRepository.listByAdId(ad.id);
    }),
  );

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title={t("dashboard.nav.reportedAds")} subtitle={t("ads.reported.subtitle")} />
      <ReportedAdsView ads={ads} reportsByAdId={reportsByAdId} categories={categories} />
    </div>
  );
}