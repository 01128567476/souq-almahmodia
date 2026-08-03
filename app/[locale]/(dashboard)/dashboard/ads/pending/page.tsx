import { setRequestLocale, getTranslations } from "next-intl/server";
import { adRepository } from "@/services/repositories/adRepository";
import { categoryRepository } from "@/services/repositories/categoryRepository";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { PendingAdsView } from "@/components/dashboard/PendingAdsView";
import type { Locale } from "@/i18n/routing";

export default async function PendingAdsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const [ads, categories] = await Promise.all([
    adRepository.listPending(),
    categoryRepository.list(),
  ]);

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title={t("dashboard.nav.pendingAds")} subtitle={t("ads.pending.subtitle")} />
      <PendingAdsView initialAds={ads} categories={categories} />
    </div>
  );
}