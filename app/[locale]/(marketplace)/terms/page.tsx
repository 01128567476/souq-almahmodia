import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className="max-w-3xl mx-auto px-margin py-2xl">
      <h1 className="text-display-lg font-display-lg text-on-surface mb-lg">
        {t("pages.termsTitle")}
      </h1>
      <p className="text-body-lg font-body-lg text-on-surface-variant leading-relaxed">
        {t("pages.termsBody")}
      </p>
    </div>
  );
}
