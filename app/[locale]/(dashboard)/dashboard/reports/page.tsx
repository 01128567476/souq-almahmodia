import { setRequestLocale, getTranslations } from "next-intl/server";
import { getReports } from "@/services/dashboard";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ReportsTable } from "./ReportsTable";
import type { Locale } from "@/i18n/routing";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title={t("reports.title")} subtitle={t("reports.subtitle")} />
      <ReportsTable reports={await getReports()} />
    </div>
  );
}
