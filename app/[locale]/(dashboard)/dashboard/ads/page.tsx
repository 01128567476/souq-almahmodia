import { setRequestLocale, getTranslations } from "next-intl/server";
import { adRepository } from "@/services/repositories/adRepository";
import { categoryRepository } from "@/services/repositories/categoryRepository";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { AllAdsView } from "@/components/dashboard/AllAdsView";
import type { Locale } from "@/i18n/routing";

export default async function AllAdsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const [ads, categories] = await Promise.all([
    adRepository.list(),
    categoryRepository.list(),
  ]);

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title={t("dashboard.nav.allAds")} subtitle={t("ads.all.subtitle")} />
      <AllAdsView initialAds={ads} categories={categories} />
    </div>
  );
}