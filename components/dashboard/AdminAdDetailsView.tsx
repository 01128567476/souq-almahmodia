"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { Icon } from "@/components/ui/Icon";
import { AdStatusBadge } from "@/components/ui/StatusBadge";
import { PendingAdEditForm } from "@/components/dashboard/PendingAdEditForm";
import { formatPrice, formatDate } from "@/utils/format";
import { resolveCategoryName } from "@/utils/category";
import type { Category, Product, AdReport, Comment, EngagementStats } from "@/types";
import type { Locale } from "@/i18n/routing";

export function AdminAdDetailsView({
  initialAd,
  category,
  reports,
  stats,
  comments,
  categories,
}: {
  initialAd: Product;
  category: Category | null;
  reports: AdReport[];
  stats: EngagementStats;
  comments: Comment[];
  categories: Category[];
}) {
  const [ad, setAd] = useState<Product>(initialAd);
  const [reportList, setReportList] = useState<AdReport[]>(reports);
  const [statsState, setStatsState] = useState<EngagementStats>(stats);
  const [commentsState] = useState<Comment[]>(comments);
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = useTranslations();
  const locale = useLocale() as Locale;

  const categoryName = category ? resolveCategoryName(category, locale) : ad.categorySlug;
  const whatsappPhone = ad.sellerPhone?.replace(/[^0-9]/g, "") || "";

  const performApiAction = async (url: string, options: RequestInit = {}) => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error("Action failed.");
      }
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleAction = async (action: string, body?: Record<string, unknown>) => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/ads/${ad.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      if (!response.ok) {
        throw new Error("Unable to perform action.");
      }
      const payload = await response.json();
      if (payload?.id) {
        setAd(payload as Product);
      }
      if (action === "ignoreReports") {
        setReportList([]);
      }
      return payload;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    const payload = await performApiAction(`/api/ads/${ad.id}/approve`, { method: "POST" });
    if (payload?.id) setAd(payload as Product);
  };

  const handleReject = async () => {
    const payload = await performApiAction(`/api/ads/${ad.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason }),
    });
    if (payload?.id) {
      setAd(payload as Product);
      setRejecting(false);
      setRejectReason("");
    }
  };

  const handleHide = async () => {
    const payload = await handleAction(ad.status === "hidden" ? "unhide" : "hide");
    if (payload?.id) setAd(payload as Product);
  };

  const handlePin = async () => {
    const payload = await handleAction(ad.pinned ? "unpin" : "pin");
    if (payload?.id) setAd(payload as Product);
  };

  const handleFeature = async () => {
    const payload = await handleAction(ad.featured ? "unfeature" : "feature");
    if (payload?.id) setAd(payload as Product);
  };

  const handleDelete = async () => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/ads/${ad.id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Failed to delete ad.");
      }
      setAd({ ...ad, status: "deleted" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async (patch: Partial<Product>) => {
    const response = await fetch(`/api/ads/${ad.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      throw new Error("Failed to save ad changes.");
    }
    const updatedAd = (await response.json()) as Product;
    setAd(updatedAd);
    setEditing(false);
  };

  return (
    <div className="space-y-xl">
      {error ? (
        <div className="rounded-3xl border border-error bg-error-container/10 p-lg text-error">{error}</div>
      ) : null}

      <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-lg">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
              <div className="relative h-80 rounded-[2rem] bg-surface-container-lowest overflow-hidden">
                <Image src={ad.images?.[0] ?? ad.image} alt={ad.title} fill sizes="(max-width: 1024px) 100vw, 360px" className="object-cover" />
              </div>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <AdStatusBadge status={ad.status} />
                  <span className="rounded-full bg-surface-container-highest px-3 py-1 text-label-md font-label-md text-on-surface">{formatPrice(ad.price, ad.currency, locale)}</span>
                </div>
                <h1 className="text-headline-lg font-headline-lg text-on-surface">{ad.title}</h1>
                <p className="text-body-md text-on-surface-variant">{ad.description ?? "—"}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-outline-variant bg-surface-container-highest p-4">
                    <p className="text-label-sm font-label-sm text-on-surface-variant">{t("ads.category")}</p>
                    <p className="mt-2 text-body-md text-on-surface">{categoryName}</p>
                  </div>
                  <div className="rounded-3xl border border-outline-variant bg-surface-container-highest p-4">
                    <p className="text-label-sm font-label-sm text-on-surface-variant">{t("ads.location")}</p>
                    <p className="mt-2 text-body-md text-on-surface">{ad.location}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-outline-variant bg-surface-container-highest p-4">
                <p className="text-label-sm font-label-sm text-on-surface-variant">{t("ads.seller")}</p>
                <p className="mt-2 text-body-md text-on-surface">{ad.sellerName}</p>
              </div>
              <div className="rounded-3xl border border-outline-variant bg-surface-container-highest p-4">
                <p className="text-label-sm font-label-sm text-on-surface-variant">{t("ads.phone")}</p>
                <p className="mt-2 text-body-md text-on-surface">{ad.sellerPhone}</p>
              </div>
              <div className="rounded-3xl border border-outline-variant bg-surface-container-highest p-4">
                <p className="text-label-sm font-label-sm text-on-surface-variant">WhatsApp</p>
                {whatsappPhone ? (
                  <a href={`https://wa.me/${whatsappPhone}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-body-md font-body-md text-primary hover:underline">
                    <Icon name="chat" size={18} />
                    {t("product.whatsapp")}
                  </a>
                ) : (
                  <p className="mt-2 text-body-md text-on-surface">—</p>
                )}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-outline-variant bg-surface-container-highest p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-label-sm font-label-sm text-on-surface-variant">{t("ads.date")}</p>
                  <p className="mt-2 text-body-md text-on-surface">{ad.createdAt ? formatDate(ad.createdAt, locale) : "—"}</p>
                </div>
                <div>
                  <p className="text-label-sm font-label-sm text-on-surface-variant">{t("ads.status")}</p>
                  <div className="mt-2"><AdStatusBadge status={ad.status} /></div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-outline-variant bg-surface-container-highest p-6">
              <h2 className="text-label-md font-label-md text-on-surface-variant">{t("engagement.views")}</h2>
              <p className="mt-2 text-headline-sm font-headline-sm text-on-surface">{statsState.views}</p>
              <div className="mt-4 grid gap-3">
                <div className="rounded-3xl bg-surface-container p-4">
                  <p className="text-label-sm font-label-sm text-on-surface-variant">{t("engagement.reactions")}</p>
                  <p className="mt-1 text-body-md text-on-surface">{statsState.reactions}</p>
                </div>
                <div className="rounded-3xl bg-surface-container p-4">
                  <p className="text-label-sm font-label-sm text-on-surface-variant">{t("engagement.comments")}</p>
                  <p className="mt-1 text-body-md text-on-surface">{statsState.comments}</p>
                </div>
                <div className="rounded-3xl bg-surface-container p-4">
                  <p className="text-label-sm font-label-sm text-on-surface-variant">{t("engagement.favorites")}</p>
                  <p className="mt-1 text-body-md text-on-surface">{statsState.favorites}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-outline-variant bg-surface-container-highest p-6">
              <h2 className="text-label-md font-label-md text-on-surface-variant">{t("common.actions")}</h2>
              <div className="mt-4 grid gap-3">
                <Link
                  href={ROUTES.product(ad.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-label-md font-label-md text-on-surface transition hover:bg-surface-container-highest"
                >
                  <Icon name="visibility" size={18} />
                  {t("ads.view")}
                </Link>
                {ad.status === "pending" ? (
                  <button type="button" onClick={handleApprove} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-success px-4 py-3 text-label-md font-label-md text-on-primary transition hover:brightness-110 disabled:opacity-60">
                    <Icon name="check" size={18} />
                    {t("ads.approve")}
                  </button>
                ) : null}
                <button type="button" onClick={() => setRejecting((current) => !current)} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-error text-error px-4 py-3 text-label-md font-label-md transition hover:bg-error/10 disabled:opacity-60">
                  <Icon name="cancel" size={18} />
                  {t("ads.reject")}
                </button>
                <button type="button" onClick={handleHide} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-label-md font-label-md text-on-surface transition hover:bg-surface-container-highest disabled:opacity-60">
                  <Icon name={ad.status === "hidden" ? "visibility" : "visibility_off"} size={18} />
                  {t(ad.status === "hidden" ? "ads.unhide" : "ads.hide")}
                </button>
                <button type="button" onClick={() => setEditing((current) => !current)} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-label-md font-label-md text-on-surface transition hover:bg-surface-container-highest disabled:opacity-60">
                  <Icon name="edit" size={18} />
                  {t("ads.edit")}
                </button>
                <button type="button" onClick={handlePin} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-label-md font-label-md text-on-surface transition hover:bg-surface-container-highest disabled:opacity-60">
                  <Icon name="push_pin" size={18} />
                  {t(ad.pinned ? "ads.unpin" : "ads.pin")}
                </button>
                <button type="button" onClick={handleFeature} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-label-md font-label-md text-on-surface transition hover:bg-surface-container-highest disabled:opacity-60">
                  <Icon name="star" size={18} />
                  {t(ad.featured ? "ads.unfeature" : "ads.feature")}
                </button>
                <button type="button" onClick={handleDelete} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-error text-error px-4 py-3 text-label-md font-label-md transition hover:bg-error/10 disabled:opacity-60">
                  <Icon name="delete" size={18} />
                  {t("ads.delete")}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {rejecting ? (
        <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-lg">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-headline-sm font-headline-sm text-on-surface">{t("ads.rejectReason")}</h2>
            <button type="button" onClick={() => setRejecting(false)} className="text-on-surface-variant hover:text-on-surface">
              <Icon name="close" size={18} />
            </button>
          </div>
          <textarea
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            rows={4}
            placeholder={t("ads.rejectReasonPlaceholder")}
            className="mt-4 w-full rounded-2xl border border-outline-variant bg-surface-container py-md px-md text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={handleReject} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-error px-4 py-3 text-label-md font-label-md text-on-primary transition hover:brightness-110 disabled:opacity-60">
              <Icon name="cancel" size={18} />
              {t("ads.reject")}
            </button>
            <button type="button" onClick={() => setRejecting(false)} className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-3 text-label-md font-label-md text-on-surface transition hover:bg-surface-container-highest">
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : null}

      {editing ? (
        <PendingAdEditForm
          ad={ad}
          categories={categories}
          onCancel={() => setEditing(false)}
          onSave={handleSave}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-outline-variant bg-surface-container-highest p-6">
            <h2 className="text-headline-sm font-headline-sm text-on-surface">{t("ads.description")}</h2>
            <p className="mt-4 text-body-md text-on-surface">{ad.description ?? "—"}</p>
          </section>

          <section className="rounded-3xl border border-outline-variant bg-surface-container-highest p-6">
            <h2 className="text-headline-sm font-headline-sm text-on-surface">{t("ads.adminNotes")}</h2>
            <p className="mt-4 text-body-md text-on-surface">{ad.adminNotes ?? t("ads.noAdminNotes")}</p>
          </section>

          <section className="rounded-3xl border border-outline-variant bg-surface-container-highest p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-headline-sm font-headline-sm text-on-surface">{t("reports.title")}</h2>
              <span className="rounded-full bg-surface-container-lowest px-3 py-1 text-label-sm font-label-sm text-on-surface-variant">{reportList.length} {t("ads.reportsCount")}</span>
            </div>
            <div className="mt-4 space-y-4">
              {reportList.length === 0 ? (
                <p className="text-body-md text-on-surface-variant">{t("ads.noReports")}</p>
              ) : (
                reportList.map((report) => (
                  <div key={report.id} className="rounded-3xl border border-outline-variant bg-surface-container p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-body-md font-medium text-on-surface">{report.reason}</p>
                      <span className="text-label-sm text-on-surface-variant">{formatDate(report.createdAt, locale)}</span>
                    </div>
                    <p className="mt-2 text-body-sm text-on-surface-variant">{t("reports.reporter")}: {report.reporterName}</p>
                    {report.description ? <p className="mt-2 text-body-sm text-on-surface">{report.description}</p> : null}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-outline-variant bg-surface-container-highest p-6">
            <h2 className="text-headline-sm font-headline-sm text-on-surface">{t("engagement.comments")}</h2>
            <p className="mt-2 text-body-md text-on-surface-variant">{statsState.comments} {t("engagement.comments")}</p>
            <div className="mt-4 flex flex-col gap-4">
              {commentsState.length === 0 ? (
                <p className="py-xl text-center font-body-md text-body-md text-on-surface-variant">{t("engagement.noComments")}</p>
              ) : (
                commentsState.slice(0, 4).map((comment) => (
                  <div key={comment.id} className="rounded-2xl border border-outline-variant bg-surface-container px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="font-label-md font-medium text-on-surface truncate max-w-[180px] sm:max-w-none">
                        {comment.author.name}
                      </span>
                      <span className="text-label-sm text-on-surface-variant shrink-0">
                        {formatDate(comment.createdAt, locale)}
                      </span>
                    </div>
                    <p className="text-body-md text-on-surface whitespace-pre-line break-words leading-relaxed">
                      {comment.body}
                    </p>
                    {comment.replies.length > 0 ? (
                      <div className="mt-3 rounded-xl bg-surface-container-low px-3 py-2 space-y-3">
                        {comment.replies.map((reply) => (
                          <div key={reply.id}>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                              <span className="text-label-md font-medium text-on-surface truncate max-w-[150px] sm:max-w-none">
                                {reply.author.name}
                              </span>
                              <span className="text-label-sm text-on-surface-variant shrink-0">
                                {formatDate(reply.createdAt, locale)}
                              </span>
                            </div>
                            <p className="text-body-sm text-on-surface whitespace-pre-line break-words leading-relaxed">
                              {reply.body}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
