import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { AnalyticsView } from "@/components/dashboard/AnalyticsView";
import { adRepository } from "@/services/repositories/adRepository";
import { categoryRepository } from "@/services/repositories/categoryRepository";
import { userRepository } from "@/services/repositories/userRepository";
import { reportRepository } from "@/services/repositories/reportRepository";
import { engagementService } from "@/services/engagement";
import type { Locale } from "@/i18n/routing";
import type { StatCard } from "@/types";

function buildCountsByDay(labels: string[], dates: string[]) {
  const counts = labels.reduce<Record<string, number>>((acc, label) => {
    acc[label] = 0;
    return acc;
  }, {});

  for (const rawDate of dates) {
    const date = new Date(rawDate);
    const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (label in counts) counts[label] += 1;
  }

  return labels.map((label) => ({ label, value: counts[label] ?? 0 }));
}

function buildLabelsForLastDays(days = 7) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
}

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const [ads, categories, users, openReports] = await Promise.all([
    adRepository.list(),
    categoryRepository.list(),
    userRepository.list(),
    reportRepository.listOpenReports(),
  ]);

  const reportTotals = openReports.length;
  const allStats = await engagementService.getStatsBatch(ads.map((ad) => ad.id));
  const totals = Object.values(allStats).reduce(
    (acc, stat) => {
      acc.views += stat.views;
      acc.comments += stat.comments;
      acc.favorites += stat.favorites;
      acc.reactions += stat.reactions;
      return acc;
    },
    { views: 0, comments: 0, favorites: 0, reactions: 0 },
  );

  const statusCounts = await adRepository.countByStatus();
  const labels = buildLabelsForLastDays();
  const adsPerDay = buildCountsByDay(labels, ads.map((ad) => ad.createdAt ?? new Date().toISOString()));
  const usersPerDay = buildCountsByDay(labels, users.map((user) => user.joinedDate));

  const mostViewedAds = Object.entries(allStats)
    .sort(([, a], [, b]) => b.views - a.views)
    .slice(0, 5)
    .map(([adId, stat]) => {
      const ad = ads.find((item) => item.id === adId);
      return { label: ad?.title ?? adId, value: stat.views };
    });

  const mostActiveCategories = categories
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((category) => ({ label: category.nameEn ?? category.name, value: category.count }));

  const reportCountsByAd = openReports.reduce((acc, report) => {
    acc[report.adId] = (acc[report.adId] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const mostReportedAds = Object.entries(reportCountsByAd)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([adId, count]) => {
      const ad = ads.find((item) => item.id === adId);
      return { label: ad?.title ?? adId, value: count };
    });

  const stats: StatCard[] = [
    { labelKey: "users", value: `${users.length}`, delta: "+2%", icon: "group", tone: "secondary" },
    { labelKey: "ads", value: `${ads.length}`, delta: "+4%", icon: "campaign", tone: "primary" },
    { labelKey: "pendingAds", value: `${statusCounts.pending}`, delta: "+8%", icon: "pending_actions", tone: "primary" },
    { labelKey: "approvedAds", value: `${statusCounts.approved}`, delta: "+5%", icon: "verified", tone: "secondary" },
    { labelKey: "rejectedAds", value: `${statusCounts.rejected}`, delta: "-1%", icon: "cancel", tone: "error" },
    { labelKey: "hiddenAds", value: `${statusCounts.hidden}`, delta: "0%", icon: "visibility_off", tone: "tertiary" },
    { labelKey: "expiredAds", value: `${statusCounts.expired}`, delta: "-2%", icon: "schedule", tone: "tertiary" },
    { labelKey: "reports", value: `${reportTotals}`, delta: "-3%", icon: "flag", tone: "error" },
    { labelKey: "favorites", value: `${totals.favorites}`, delta: "+7%", icon: "favorite", tone: "secondary" },
    { labelKey: "comments", value: `${totals.comments}`, delta: "+4%", icon: "chat_bubble", tone: "secondary" },
    { labelKey: "reactions", value: `${totals.reactions}`, delta: "+6%", icon: "thumb_up", tone: "primary" },
    { labelKey: "views", value: `${totals.views}`, delta: "+9%", icon: "visibility", tone: "tertiary" },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title={t("analytics.title")} subtitle={t("analytics.subtitle")} />
      <AnalyticsView
        stats={stats}
        adsPerDay={adsPerDay}
        usersPerDay={usersPerDay}
        activityMetrics={[
          { label: t("analytics.views"), value: totals.views },
          { label: t("analytics.reactions"), value: totals.reactions },
          { label: t("analytics.comments"), value: totals.comments },
          { label: t("analytics.favorites"), value: totals.favorites },
          { label: t("analytics.reports"), value: reportTotals },
        ]}
        mostViewedAds={mostViewedAds}
        mostActiveCategories={mostActiveCategories}
        mostReportedAds={mostReportedAds}
      />
    </div>
  );
}
