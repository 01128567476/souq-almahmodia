import { setRequestLocale, getTranslations } from "next-intl/server";
import { getDashboardStats } from "@/services/dashboard";
import { adRepository } from "@/services/repositories/adRepository";
import { StatCard } from "@/components/dashboard/StatCard";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { AdStatusBadge } from "@/components/ui/StatusBadge";
import { Icon } from "@/components/ui/Icon";
import { formatPrice } from "@/utils/format";
import type { Locale } from "@/i18n/routing";
import type { Product } from "@/types";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const stats = await getDashboardStats();
  const recentAds: Product[] = (await adRepository.listPending()).slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title={t("dashboard.title")} subtitle={t("dashboard.welcome")} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-lg mb-xl">
        {stats.map((stat) => (
          <StatCard key={stat.labelKey} stat={stat} />
        ))}
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-lg">
        <h2 className="text-headline-md font-headline-md text-on-surface mb-lg">
          {t("dashboard.recentActivity")}
        </h2>
        <div className="space-y-md">
          {recentAds.map((ad) => (
            <div
              key={ad.id}
              className="flex items-center justify-between p-md rounded-xl hover:bg-surface-container-low transition-colors"
            >
              <div className="flex items-center gap-md min-w-0">
                <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-primary shrink-0">
                  <Icon name="campaign" size={20} />
                </div>
                <div className="min-w-0">
                  <p className="font-label-md text-label-md text-on-surface truncate">
                    {ad.title}
                  </p>
                  <p className="text-body-sm font-body-sm text-on-surface-variant">
                    {ad.sellerName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-md shrink-0">
                <span className="font-bold text-on-surface hidden sm:block">
                  {formatPrice(ad.price, ad.currency, locale)}
                </span>
                <AdStatusBadge status={ad.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}