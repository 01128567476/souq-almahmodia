import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/i18n/routing";

export default async function AdSubmittedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { locale } = await params;
  const { id } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("ads");

  return (
    <div className="max-w-lg mx-auto py-xl">
      <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-xl text-center">
        <div className="w-20 h-20 rounded-full bg-success-container text-success flex items-center justify-center mx-auto mb-lg">
          <Icon name="check_circle" size={40} />
        </div>
        
        <h1 className="text-headline-lg font-headline-lg text-on-surface mb-sm">
          {t("published")}
        </h1>
        
        <p className="text-body-md font-body-md text-on-surface-variant mb-lg">
          {t("submissionPending") ?? "Your advertisement has been sent for review. It will become visible after an administrator approves it."}
        </p>
        
        <div className="space-y-md pt-lg">
          <Link
            href={ROUTES.accountAds}
            className="flex items-center justify-center gap-2 w-full py-md px-lg bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <Icon name="pending_actions" size={20} />
            {t("viewPending") ?? "View Pending Advertisements"}
          </Link>
          
          <Link
            href={ROUTES.home}
            className="flex items-center justify-center gap-2 w-full py-md px-lg border border-outline-variant rounded-xl font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <Icon name="home" size={20} />
            {t("backToMarketplace") ?? "Back to Marketplace"}
          </Link>
        </div>
      </div>
    </div>
  );
}
