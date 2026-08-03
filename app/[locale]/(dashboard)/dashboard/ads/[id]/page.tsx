import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { adRepository } from "@/services/repositories/adRepository";
import { categoryRepository } from "@/services/repositories/categoryRepository";
import { reportRepository } from "@/services/repositories/reportRepository";
import { commentRepository } from "@/services/repositories/commentRepository";
import { engagementService } from "@/services/engagement";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { AdminAdDetailsView } from "@/components/dashboard/AdminAdDetailsView";
import type { Locale } from "@/i18n/routing";

export default async function AdminAdDetailsPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const ad = await adRepository.getById(id);
  if (!ad) notFound();

  const [category, reports, stats, comments, categories] = await Promise.all([
    categoryRepository.getBySlug(ad.categorySlug),
    reportRepository.listByAdId(ad.id),
    engagementService.getStats(ad.id),
    commentRepository.listByAd(ad.id, null),
    categoryRepository.list(),
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-xl">
      <PageHeader title={t("dashboard.nav.adDetails")} subtitle={t("ads.details.subtitle") ?? ""} />
      <AdminAdDetailsView
        initialAd={ad}
        category={category}
        reports={reports}
        stats={stats}
        comments={comments}
        categories={categories}
      />
    </div>
  );
}
