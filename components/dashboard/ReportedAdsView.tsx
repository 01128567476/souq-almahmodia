"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { Icon } from "@/components/ui/Icon";
import { AdStatusBadge } from "@/components/ui/StatusBadge";
import { formatPrice, formatDate } from "@/utils/format";
import { resolveCategoryName } from "@/utils/category";
import type { Category, Product, AdReport } from "@/types";
import type { Locale } from "@/i18n/routing";

export function ReportedAdsView({
  ads,
  reportsByAdId,
  categories,
}: {
  ads: Product[];
  reportsByAdId: Record<string, AdReport[]>;
  categories: Category[];
}) {
  const [activeAds, setActiveAds] = useState<Product[]>(ads);
  const [reportData, setReportData] = useState<Record<string, AdReport[]>>(reportsByAdId);
  const [busyAdId, setBusyAdId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = useTranslations();
  const locale = useLocale() as Locale;

  const getCategoryName = (slug: string) => {
    const category = categories.find((category) => category.slug === slug);
    return category ? resolveCategoryName(category, locale) : slug;
  };

  const handleAction = async (adId: string, action: string) => {
    setError(null);
    setBusyAdId(adId);
    try {
      if (action === "delete") {
        const response = await fetch(`/api/ads/${adId}`, { method: "DELETE" });
        if (!response.ok) {
          throw new Error("Unable to delete ad.");
        }
        setActiveAds((prev) => prev.filter((ad) => ad.id !== adId));
        return;
      }

      const response = await fetch(`/api/ads/${adId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        throw new Error("Unable to perform action.");
      }
      const payload = await response.json();
      if (action === "ignoreReports") {
        setActiveAds((prev) => prev.filter((ad) => ad.id !== adId));
        return;
      }
      if (payload?.id) {
        setActiveAds((prev) => prev.map((ad) => (ad.id === adId ? payload : ad)));
      }
      if (action === "hide" || action === "suspend") {
        setReportData((prev) => ({ ...prev, [adId]: prev[adId] }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAdId(null);
    }
  };

  const visibleAds = useMemo(() => {
    return activeAds.filter((ad) => (reportData[ad.id] ?? []).length > 0);
  }, [activeAds, reportData]);

  if (visibleAds.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-outline-variant bg-surface-container-lowest p-xl text-on-surface-variant">
        {t("ads.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-xl">
      {error ? (
        <div className="rounded-3xl border border-error bg-error-container/10 p-lg text-error">{error}</div>
      ) : null}
      <div className="grid gap-xl">
        {visibleAds.map((ad) => {
          const reports = reportData[ad.id] ?? [];
          const reportCount = reports.length;
          const reporters = [...new Set(reports.map((report) => report.reporterName))];
          const reasons = [...new Set(reports.map((report) => report.reason))];
          const latestReport = reports[0];

          return (
            <article key={ad.id} className="overflow-hidden rounded-[2rem] border border-outline-variant bg-surface-container-low">
              <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="relative h-72 lg:h-full bg-surface-container-lowest">
                  <Image
                    src={ad.image}
                    alt={ad.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 320px"
                    className="object-cover"
                    onError={(e) => { e.currentTarget.src = "/placeholder-image.svg"; }}
                  />
                </div>
                <div className="p-lg md:p-xl">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <h2 className="text-headline-md font-headline-md text-on-surface">{ad.title}</h2>
                      <p className="mt-3 text-body-md font-body-md text-on-surface-variant">{ad.description?.slice(0, 120) ?? "—"}{ad.description && ad.description.length > 120 ? "…" : ""}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <AdStatusBadge status={ad.status} />
                      <span className="rounded-full bg-surface-container-highest px-3 py-1 text-label-md font-label-md text-on-surface">{formatPrice(ad.price, ad.currency, locale)}</span>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <dl className="space-y-3">
                      <dt className="text-label-md font-label-md text-on-surface-variant">{t("ads.category")}</dt>
                      <dd className="text-body-md font-body-md text-on-surface">{getCategoryName(ad.categorySlug)}</dd>
                    </dl>
                    <dl className="space-y-3">
                      <dt className="text-label-md font-label-md text-on-surface-variant">{t("ads.seller")}</dt>
                      <dd className="text-body-md font-body-md text-on-surface">{ad.sellerName}</dd>
                    </dl>
                    <dl className="space-y-3">
                      <dt className="text-label-md font-label-md text-on-surface-variant">{t("ads.phone")}</dt>
                      <dd className="text-body-md font-body-md text-on-surface">{ad.sellerPhone}</dd>
                    </dl>
                    <dl className="space-y-3">
                      <dt className="text-label-md font-label-md text-on-surface-variant">{t("ads.location")}</dt>
                      <dd className="text-body-md font-body-md text-on-surface">{ad.location}</dd>
                    </dl>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-3xl border border-outline-variant bg-surface-container-highest p-4">
                      <p className="text-label-sm font-label-sm text-on-surface-variant">{t("ads.reportsCount")}</p>
                      <p className="mt-2 text-headline-sm font-headline-sm text-on-surface">{reportCount}</p>
                    </div>
                    <div className="rounded-3xl border border-outline-variant bg-surface-container-highest p-4">
                      <p className="text-label-sm font-label-sm text-on-surface-variant">{t("ads.reporters")}</p>
                      <p className="mt-2 text-body-md font-body-md text-on-surface">{reporters.join(", ")}</p>
                    </div>
                    <div className="rounded-3xl border border-outline-variant bg-surface-container-highest p-4">
                      <p className="text-label-sm font-label-sm text-on-surface-variant">{t("ads.reportDates")}</p>
                      <p className="mt-2 text-body-md font-body-md text-on-surface">{latestReport ? formatDate(latestReport.createdAt, locale) : "—"}</p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="rounded-3xl border border-outline-variant bg-surface-container-highest p-4">
                      <h3 className="text-label-md font-label-md text-on-surface-variant">{t("reports.reason")}</h3>
                      <p className="mt-2 text-body-md text-on-surface">{reasons.join(", ")}</p>
                    </div>
                    <div className="rounded-3xl border border-outline-variant bg-surface-container-highest p-4">
                      <h3 className="text-label-md font-label-md text-on-surface-variant">{t("reports.status")}</h3>
                      <p className="mt-2 text-body-md text-on-surface">{latestReport?.status ?? "—"}</p>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      href={ROUTES.product(ad.id)}
                      className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-label-md font-label-md text-on-surface transition hover:bg-surface-container-highest"
                    >
                      <Icon name="visibility" size={18} />
                      {t("ads.view")}
                    </Link>
                    <button
                      type="button"
                      disabled={busyAdId === ad.id}
                      onClick={() => handleAction(ad.id, "ignoreReports")}
                      className="inline-flex items-center gap-2 rounded-xl border-2 border-warning bg-warning/15 px-4 py-3 text-label-md font-label-md font-semibold text-warning transition hover:bg-warning/25 disabled:opacity-60"
                    >
                      <Icon name="task_alt" size={18} />
                      {t("ads.ignoreReport")}
                    </button>
                    <button
                      type="button"
                      disabled={busyAdId === ad.id}
                      onClick={() => handleAction(ad.id, ad.status === "hidden" ? "unhide" : "hide")}
                      className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-label-md font-label-md text-on-surface transition hover:bg-surface-container-highest disabled:opacity-60"
                    >
                      <Icon name={ad.status === "hidden" ? "visibility" : "visibility_off"} size={18} />
                      {t(ad.status === "hidden" ? "ads.unhide" : "ads.hide")}
                    </button>
                    <button
                      type="button"
                      disabled={busyAdId === ad.id}
                      onClick={() => handleAction(ad.id, "delete")}
                      className="inline-flex items-center gap-2 rounded-xl border border-error text-error px-4 py-3 text-label-md font-label-md transition hover:bg-error/10 disabled:opacity-60"
                    >
                      <Icon name="delete" size={18} />
                      {t("ads.delete")}
                    </button>
                    <button
                      type="button"
                      disabled={busyAdId === ad.id}
                      onClick={() => handleAction(ad.id, "warn")}
                      className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-label-md font-label-md text-on-surface transition hover:bg-surface-container-highest disabled:opacity-60"
                    >
                      <Icon name="warning" size={18} />
                      {t("ads.warnSeller")}
                    </button>
                    <button
                      type="button"
                      disabled={busyAdId === ad.id}
                      onClick={() => handleAction(ad.id, "suspend")}
                      className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-label-md font-label-md text-on-surface transition hover:bg-surface-container-highest disabled:opacity-60"
                    >
                      <Icon name="block" size={18} />
                      {t("ads.suspendSeller")}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
