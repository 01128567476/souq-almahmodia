"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { DataTable, type Column } from "@/components/dashboard/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { AdStatusBadge, ReportStatusBadge, SeverityBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatPrice } from "@/utils/format";
import { resolveCategoryName } from "@/utils/category";
import type { Locale } from "@/i18n/routing";
import type { DirectoryUser, Product, AdReport, Comment, AuditLogEntry, Category } from "@/types";

type Tab = "profile" | "ads" | "reports" | "comments" | "activity";

interface UserDetailsViewProps {
  user: DirectoryUser;
  ads: Product[];
  reports: AdReport[];
  comments: Comment[];
  activity: AuditLogEntry[];
  categories: Category[];
}

export function UserDetailsView({ user, ads, reports, comments, activity, categories }: UserDetailsViewProps) {
  const [selectedTab, setSelectedTab] = useState<Tab>("profile");
  const [currentUser, setCurrentUser] = useState<DirectoryUser>(user);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();

  const activeAds = ads.length;
  const reportCount = reports.length;
  const commentCount = comments.length;
  const activityCount = activity.length;

  const adCategoryName = (product: Product) => {
    const category = categories.find((item) => item.slug === product.categorySlug);
    return category ? resolveCategoryName(category, locale) : product.categorySlug;
  };

  const sortedActivity = useMemo(
    () => [...activity].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [activity],
  );

  const handleStatusChange = async (nextStatus: "active" | "suspended") => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error("Unable to update user status.");
      const updated = (await response.json()) as DirectoryUser;
      setCurrentUser(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete user.");
      router.push(ROUTES.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const adColumns: Column<Product>[] = [
    {
      key: "title",
      header: t("ads.title"),
      cell: (ad) => (
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 overflow-hidden rounded-2xl bg-surface-container-lowest">
            {ad.image ? (
              <Image src={ad.image} alt={ad.title} fill sizes="48px" className="object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full w-full">
                <Icon name="image_not_supported" size={16} className="text-on-surface-variant" />
              </div>
            )}
          </div>
          <div>
            <div className="font-medium text-on-surface">{ad.title}</div>
            <div className="text-label-sm text-on-surface-variant">{ad.location}</div>
          </div>
        </div>
      ),
    },
    { key: "category", header: t("ads.category"), cell: (ad) => adCategoryName(ad) },
    { key: "price", header: t("ads.price"), cell: (ad) => formatPrice(ad.price, ad.currency, locale) },
    { key: "status", header: t("ads.status"), cell: (ad) => <AdStatusBadge status={ad.status} /> },
    { key: "date", header: t("ads.date"), cell: (ad) => (ad.createdAt ? formatDate(ad.createdAt, locale) : "—") },
    {
      key: "actions",
      header: t("common.actions"),
      cell: (ad) => (
        <Link href={ROUTES.product(ad.id)} className="text-primary font-label-md hover:underline">
          {t("ads.view")}
        </Link>
      ),
    },
  ];

  const reportColumns: Column<AdReport>[] = [
    { key: "reporter", header: t("reports.reporter"), cell: (report) => report.reporterName },
    { key: "reason", header: t("reports.reason"), cell: (report) => t(`reports.${report.reason}`) ?? report.reason },
    {
      key: "severity",
      header: t("reports.severity"),
      cell: (report) => <SeverityBadge severity={report.severity} />,
    },
    {
      key: "status",
      header: t("reports.status"),
      cell: (report) => <ReportStatusBadge status={report.status} />,
    },
    { key: "date", header: t("reports.date"), cell: (report) => formatDate(report.createdAt, locale) },
  ];

  return (
    <div className="space-y-xl">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-xl">
        <div className="flex flex-col lg:flex-row gap-lg items-start lg:items-center justify-between">
          <div className="flex items-center gap-sm">
            {currentUser.avatar ? (
              <Image src={currentUser.avatar} alt="" width={80} height={80} className="rounded-3xl object-cover" />
            ) : (
              <div className="rounded-3xl bg-primary/20 flex items-center justify-center" style={{ width: 80, height: 80 }}>
                <span className="text-on-primary text-headline-sm font-bold">{currentUser.name?.[0]?.toUpperCase() ?? "?"}</span>
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-headline-lg font-headline-lg text-on-surface">{currentUser.name}</h1>
                <Badge tone={currentUser.status === "active" ? "success" : "error"}>
                  {t(`users.${currentUser.status}`)}
                </Badge>
              </div>
              <p className="mt-2 text-body-md text-on-surface-variant">{currentUser.email}</p>
              <p className="text-body-md text-on-surface-variant">{currentUser.phone ?? "—"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => handleStatusChange(currentUser.status === "active" ? "suspended" : "active")}
              className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-4 py-3 text-label-md font-label-md text-on-surface transition hover:bg-surface-container-highest disabled:opacity-60"
            >
              <Icon name={currentUser.status === "active" ? "block" : "check_circle"} size={18} />
              {currentUser.status === "active" ? t("users.suspend") : t("users.activate")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleDelete}
              className="inline-flex items-center gap-2 rounded-full border border-error text-error px-4 py-3 text-label-md font-label-md transition hover:bg-error/10 disabled:opacity-60"
            >
              <Icon name="delete" size={18} />
              {t("users.delete")}
            </button>
          </div>
        </div>

        {error ? <div className="mt-6 rounded-3xl border border-error bg-error-container/10 p-lg text-error">{error}</div> : null}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          <div className="rounded-3xl border border-outline-variant bg-surface-container p-lg text-center">
            <p className="text-headline-lg font-headline-lg text-on-surface">{currentUser.adsCount}</p>
            <p className="text-body-sm font-body-sm text-on-surface-variant">{t("users.adsCount")}</p>
          </div>
          <div className="rounded-3xl border border-outline-variant bg-surface-container p-lg text-center">
            <p className="text-headline-lg font-headline-lg text-on-surface">{reportCount}</p>
            <p className="text-body-sm font-body-sm text-on-surface-variant">{t("users.reportsCount")}</p>
          </div>
          <div className="rounded-3xl border border-outline-variant bg-surface-container p-lg text-center">
            <p className="text-headline-lg font-headline-lg text-on-surface">{formatDate(currentUser.joinedDate, locale)}</p>
            <p className="text-body-sm font-body-sm text-on-surface-variant">{t("users.registrationDate")}</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-lg">
        <div className="flex flex-wrap gap-3 border-b border-outline-variant pb-3 mb-6">
          {([
            { id: "profile", label: t("users.profileTab") },
            { id: "ads", label: t("users.adsTab") },
            { id: "reports", label: t("users.reportsTab") },
            { id: "comments", label: t("users.commentsTab") },
            { id: "activity", label: t("users.activityTab") },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedTab(tab.id)}
              className={`rounded-2xl px-4 py-3 text-label-md font-label-md transition ${
                selectedTab === tab.id
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface hover:bg-surface-container-highest"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {selectedTab === "profile" ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-3xl border border-outline-variant bg-surface-container p-lg">
              <h2 className="text-headline-sm font-headline-sm text-on-surface mb-4">{t("users.profileTab")}</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-label-sm font-label-sm text-on-surface-variant">{t("common.email")}</p>
                  <p className="text-body-md text-on-surface">{currentUser.email}</p>
                </div>
                <div>
                  <p className="text-label-sm font-label-sm text-on-surface-variant">{t("users.phone")}</p>
                  <p className="text-body-md text-on-surface">{currentUser.phone ?? "—"}</p>
                </div>
                <div>
                  <p className="text-label-sm font-label-sm text-on-surface-variant">{t("users.statusCol")}</p>
                  <Badge tone={currentUser.status === "active" ? "success" : "error"}>
                    {t(`users.${currentUser.status}`)}
                  </Badge>
                </div>
                <div>
                  <p className="text-label-sm font-label-sm text-on-surface-variant">{t("users.registrationDate")}</p>
                  <p className="text-body-md text-on-surface">{formatDate(currentUser.joinedDate, locale)}</p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-outline-variant bg-surface-container p-lg">
              <h2 className="text-headline-sm font-headline-sm text-on-surface mb-4">{t("dashboard.recentActivity")}</h2>
              <div className="space-y-4">
                <div className="rounded-2xl bg-surface-container-lowest p-4">
                  <p className="text-label-sm font-label-sm text-on-surface-variant">{t("users.adsTab")}</p>
                  <p className="text-headline-sm font-headline-sm text-on-surface">{activeAds}</p>
                </div>
                <div className="rounded-2xl bg-surface-container-lowest p-4">
                  <p className="text-label-sm font-label-sm text-on-surface-variant">{t("users.reportsTab")}</p>
                  <p className="text-headline-sm font-headline-sm text-on-surface">{reportCount}</p>
                </div>
                <div className="rounded-2xl bg-surface-container-lowest p-4">
                  <p className="text-label-sm font-label-sm text-on-surface-variant">{t("users.commentsTab")}</p>
                  <p className="text-headline-sm font-headline-sm text-on-surface">{commentCount}</p>
                </div>
              </div>
            </div>
          </div>
        ) : selectedTab === "ads" ? (
          <div className="rounded-3xl border border-outline-variant bg-surface-container p-lg">
            <DataTable columns={adColumns} rows={ads} rowKey={(ad) => ad.id} />
          </div>
        ) : selectedTab === "reports" ? (
          <div className="rounded-3xl border border-outline-variant bg-surface-container p-lg">
            {reports.length === 0 ? (
              <p className="text-body-md text-on-surface-variant">{t("reports.noReports") ?? t("common.noResults")}</p>
            ) : (
              <DataTable columns={reportColumns} rows={reports} rowKey={(report) => report.id} />
            )}
          </div>
        ) : selectedTab === "comments" ? (
          <div className="flex flex-col gap-4">
            {comments.length === 0 ? (
              <p className="py-xl text-center font-body-md text-body-md text-on-surface-variant">{t("engagement.noComments")}</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="rounded-2xl border border-outline-variant bg-surface-container px-4 py-3">
                  <div className="flex flex-col gap-2">
                    <p className="font-body-md text-body-md text-on-surface whitespace-pre-line break-words leading-relaxed">
                      {comment.body}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-label-sm text-on-surface-variant">
                      <span>{formatDate(comment.createdAt, locale)}</span>
                      <span className="text-label-sm text-on-surface-variant">
                        {t("ads.title")}: <span className="font-medium text-on-surface">{comment.adId}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {sortedActivity.length === 0 ? (
              <p className="text-body-md text-on-surface-variant">{t("common.noResults")}</p>
            ) : (
              sortedActivity.map((entry) => (
                <div key={entry.id} className="rounded-3xl border border-outline-variant bg-surface-container p-lg">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <p className="font-medium text-on-surface">{entry.action}</p>
                    <span className="text-label-sm text-on-surface-variant">{formatDate(entry.createdAt, locale)}</span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant">{entry.note ?? t("common.noResults")}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
