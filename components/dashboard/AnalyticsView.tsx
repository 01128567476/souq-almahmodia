"use client";

import { useTranslations } from "next-intl";
import { StatCard } from "@/components/dashboard/StatCard";
import { BarChart } from "@/components/dashboard/BarChart";
import { LineChart } from "@/components/dashboard/LineChart";
import type { Category, StatCard as StatCardType } from "@/types";

interface AnalyticsViewProps {
  stats: StatCardType[];
  adsPerDay: { label: string; value: number }[];
  usersPerDay: { label: string; value: number }[];
  activityMetrics: { label: string; value: number }[];
  mostViewedAds: { label: string; value: number }[];
  mostActiveCategories: { label: string; value: number }[];
  mostReportedAds: { label: string; value: number }[];
}

export function AnalyticsView({
  stats,
  adsPerDay,
  usersPerDay,
  activityMetrics,
  mostViewedAds,
  mostActiveCategories,
  mostReportedAds,
}: AnalyticsViewProps) {
  const t = useTranslations();

  return (
    <div className="space-y-xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-lg">
        {stats.map((stat) => (
          <StatCard key={stat.labelKey} stat={stat} />
        ))}
      </div>

      <div className="grid gap-lg lg:grid-cols-2">
        <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-xl">
          <h2 className="text-headline-sm font-headline-sm text-on-surface mb-md">
            {t("analytics.adsPerDay")}
          </h2>
          <LineChart data={adsPerDay} />
        </div>
        <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-xl">
          <h2 className="text-headline-sm font-headline-sm text-on-surface mb-md">
            {t("analytics.usersPerDay")}
          </h2>
          <LineChart data={usersPerDay} />
        </div>
      </div>

      <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-xl">
        <h2 className="text-headline-sm font-headline-sm text-on-surface mb-md">
          {t("analytics.marketplaceActivity")}
        </h2>
        <BarChart data={activityMetrics} />
      </div>

      <div className="grid gap-lg xl:grid-cols-3">
        <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-xl">
          <h2 className="text-headline-sm font-headline-sm text-on-surface mb-md">
            {t("analytics.mostViewedAds")}
          </h2>
          <BarChart data={mostViewedAds} />
        </div>
        <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-xl">
          <h2 className="text-headline-sm font-headline-sm text-on-surface mb-md">
            {t("analytics.mostActiveCategories")}
          </h2>
          <BarChart data={mostActiveCategories} />
        </div>
        <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-xl">
          <h2 className="text-headline-sm font-headline-sm text-on-surface mb-md">
            {t("analytics.mostReportedAds")}
          </h2>
          <BarChart data={mostReportedAds} />
        </div>
      </div>
    </div>
  );
}
