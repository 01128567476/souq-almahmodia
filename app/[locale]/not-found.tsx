import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { Icon } from "@/components/ui/Icon";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-margin py-2xl gap-lg">
      <Icon name="sentiment_dissatisfied" size={64} className="text-on-surface-variant" />
      <h1 className="text-display-lg font-display-lg text-on-surface">{t("title")}</h1>
      <p className="text-body-lg font-body-lg text-on-surface-variant max-w-xl">
        {t("subtitle")}
      </p>
      <Link
        href={ROUTES.home}
        className="bg-primary text-on-primary px-8 py-4 rounded-lg font-label-md text-label-md font-bold hover:opacity-90 active:scale-95 transition-all"
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
