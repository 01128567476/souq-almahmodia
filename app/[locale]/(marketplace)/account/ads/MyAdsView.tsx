"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { AdStatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { EngagementStatsRow } from "@/components/engagement/EngagementStats";
import { useEngagementStatsBatch } from "@/hooks/useEngagementStats";
import { formatPrice } from "@/utils/format";
import type { Locale } from "@/i18n/routing";
import type { Product } from "@/types";

/** "My Ads": lists the user's own listings with status, engagement, and view/edit/delete actions. */
export function MyAdsView({ ads: initialAds, locale }: { ads: Product[]; locale: Locale }) {
  const t = useTranslations("ads");
  const [ads, setAds] = useState(initialAds);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);

  // Batch-load engagement analytics for every listing shown.
  const { stats, loading: statsLoading } = useEngagementStatsBatch(
    initialAds.map((a) => a.id),
  );

  // Mock delete: drop from local state only (no backend).
  const confirmDelete = () => {
    if (pendingDelete) setAds((prev) => prev.filter((a) => a.id !== pendingDelete.id));
    setPendingDelete(null);
  };

  if (ads.length === 0) {
    return (
      <div>
        <Header />
        <EmptyState icon="sell" title={t("empty")} description={t("emptySub")} />
      </div>
    );
  }

  return (
    <div>
      <Header />
      <ul className="space-y-md">
        {ads.map((ad) => (
          <li
            key={ad.id}
            className="flex flex-col sm:flex-row gap-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-md"
          >
            <div className="relative w-full sm:w-28 h-40 sm:h-28 rounded-xl overflow-hidden bg-surface-container shrink-0">
              <Image
                src={ad.images?.[0] ?? ad.image}
                alt={ad.title}
                fill
                sizes="(max-width: 640px) 100vw, 112px"
                className="object-cover"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-sm">
                <h3 className="font-headline-md text-body-lg text-on-surface truncate">{ad.title}</h3>
                <AdStatusBadge status={ad.status} />
              </div>
              <p className="text-title-md font-title-md text-primary mt-xs">
                {formatPrice(ad.price, ad.currency, locale)}
              </p>

              <div className="mt-md">
                <EngagementStatsRow
                  stats={stats[ad.id]}
                  locale={locale}
                  variant="detailed"
                  loading={statsLoading}
                />
              </div>

              <div className="flex flex-wrap gap-sm mt-md">
                <Link
                  href={ROUTES.product(ad.id)}
                  className="flex items-center gap-xs py-xs px-md rounded-lg border border-outline-variant text-label-md font-label-md text-on-surface hover:bg-surface-container-low transition-colors"
                >
                  <Icon name="visibility" size={18} />
                  {t("view")}
                </Link>
                <Link
                  href={ROUTES.accountAdEdit(ad.id)}
                  className="flex items-center gap-xs py-xs px-md rounded-lg border border-outline-variant text-label-md font-label-md text-on-surface hover:bg-surface-container-low transition-colors"
                >
                  <Icon name="edit" size={18} />
                  {t("edit")}
                </Link>
                <button
                  type="button"
                  onClick={() => setPendingDelete(ad)}
                  className="flex items-center gap-xs py-xs px-md rounded-lg border border-error/40 text-label-md font-label-md text-error hover:bg-error-container transition-colors"
                >
                  <Icon name="delete" size={18} />
                  {t("delete")}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-margin bg-scrim/50">
          <div className="w-full max-w-sm bg-surface-container-lowest rounded-3xl shadow-xl p-lg">
            <div className="w-12 h-12 rounded-full bg-error-container text-error flex items-center justify-center mb-md">
              <Icon name="delete" />
            </div>
            <h2 className="text-headline-md font-headline-md text-on-surface">{t("confirmDelete")}</h2>
            <p className="text-body-md font-body-md text-on-surface-variant mt-xs">
              {t("confirmDeleteSub")}
            </p>
            <div className="flex gap-md mt-lg">
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-md bg-error text-on-error rounded-xl font-label-md text-label-md font-bold hover:brightness-110 transition-all"
              >
                {t("delete")}
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="flex-1 py-md border border-outline-variant rounded-xl font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors"
              >
                {t("backToAds")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Header() {
  const t = useTranslations("ads");
  return (
    <header className="flex items-start justify-between gap-md mb-xl">
      <div>
        <h2 className="text-headline-md font-headline-md text-on-surface">{t("myTitle")}</h2>
        <p className="text-body-md font-body-md text-on-surface-variant mt-xs">{t("mySubtitle")}</p>
      </div>
      <Link
        href={ROUTES.accountAdNew}
        className="flex items-center gap-xs py-sm px-md bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold hover:brightness-110 active:scale-[0.98] transition-all shrink-0"
      >
        <Icon name="add" size={20} />
        {t("newAd")}
      </Link>
    </header>
  );
}
