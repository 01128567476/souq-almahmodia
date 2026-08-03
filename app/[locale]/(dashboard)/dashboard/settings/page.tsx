import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SettingsView } from "./SettingsView";
import { settingsRepository } from "@/services/repositories/settingsRepository";
import type { Locale } from "@/i18n/routing";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const settings = await settingsRepository.get();

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <SettingsView initialSettings={settings} />
    </div>
  );
}
