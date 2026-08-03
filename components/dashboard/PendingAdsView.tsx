"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { AdStatusBadge } from "@/components/ui/StatusBadge";
import { PendingAdEditForm } from "@/components/dashboard/PendingAdEditForm";
import { formatPrice, formatDate } from "@/utils/format";
import { resolveCategoryName } from "@/utils/category";
import type { Category, Product } from "@/types";
import type { Locale } from "@/i18n/routing";

export function PendingAdsView({
  initialAds,
  categories,
}: {
  initialAds: Product[];
  categories: Category[];
}) {
  const [ads, setAds] = useState<Product[]>(initialAds);
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  const [rejectingAdId, setRejectingAdId] = useState<string | null>(null);
  const [previewingAdId, setPreviewingAdId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyAdId, setBusyAdId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = useTranslations();
  const locale = useLocale() as Locale;

  const handleApprove = async (adId: string) => {
    setError(null);
    setBusyAdId(adId);
    try {
      const response = await fetch(`/api/ads/${adId}/approve`, { method: "POST" });
      if (!response.ok) {
        throw new Error("Failed to approve ad.");
      }
      setAds((prev) => prev.filter((ad) => ad.id !== adId));
      setRejectingAdId((current) => (current === adId ? null : current));
      setEditingAdId((current) => (current === adId ? null : current));
      setPreviewingAdId((current) => (current === adId ? null : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAdId(null);
    }
  };

  const handleReject = async (adId: string) => {
    setError(null);
    setBusyAdId(adId);
    try {
      const response = await fetch(`/api/ads/${adId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!response.ok) {
        throw new Error("Failed to reject ad.");
      }
      setAds((prev) => prev.filter((ad) => ad.id !== adId));
      setRejectReason("");
      setRejectingAdId(null);
      setPreviewingAdId((current) => (current === adId ? null : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAdId(null);
    }
  };

  const handleSave = async (adId: string, patch: Partial<Product>) => {
    setError(null);
    setBusyAdId(adId);
    try {
      const response = await fetch(`/api/ads/${adId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        throw new Error("Failed to save ad changes.");
      }
      const updatedAd = (await response.json()) as Product;
      setAds((prev) => prev.map((ad) => (ad.id === adId ? updatedAd : ad)));
      setEditingAdId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAdId(null);
    }
  };

  const getCategoryName = (slug: string) => {
    const category = categories.find((category) => category.slug === slug);
    return category ? resolveCategoryName(category, locale) : slug;
  };

  if (ads.length === 0) {
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
        {ads.map((ad) => {
          const isEditing = editingAdId === ad.id;
          const isRejecting = rejectingAdId === ad.id;
          const isPreviewing = previewingAdId === ad.id;
          const primaryImage = ad.images?.[0] ?? ad.image;
          const thumbImages = ad.images?.slice(1, 3) ?? [];
          const galleryImages = ad.images?.length ? ad.images : [ad.image];
          const descriptionPreview = ad.description
            ? ad.description.length > 120
              ? `${ad.description.slice(0, 120).trim()}…`
              : ad.description
            : "—";

          return (
            <article key={ad.id} className="overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-low">
              <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="relative h-56 lg:h-full bg-surface-container-lowest">
                  <Image src={primaryImage} alt={ad.title} fill sizes="(max-width: 1024px) 100vw, 360px" className="object-cover" />
                   {thumbImages.length > 0 && (
                     <div className="absolute bottom-3 start-3 flex items-center gap-2">
                       {thumbImages.map((src, index) => (
                         <div key={`${src}-${index}`} className="relative h-12 w-12 overflow-hidden rounded-xl border border-white/70 bg-surface-container-low">
                          <Image src={src} alt="" fill sizes="64px" className="object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                 <div className="p-md md:p-lg">
                   <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                     <div>
                       <h2 className="text-headline-sm font-headline-sm text-on-surface">{ad.title}</h2>
                       <p className="mt-2 text-body-sm font-body-sm text-on-surface-variant line-clamp-2">{descriptionPreview}</p>
                     </div>
                     <div className="flex items-center gap-2 shrink-0">
                       <AdStatusBadge status={ad.status} />
                       <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-label-sm font-label-sm text-on-surface">{formatPrice(ad.price, ad.currency, locale)}</span>
                    </div>
                  </div>

                   <div className="mt-4 grid gap-3 sm:grid-cols-2">
                     <div className="space-y-1">
                       <p className="text-label-sm font-label-sm text-on-surface-variant">{t("ads.category")}</p>
                       <p className="text-body-sm font-body-sm text-on-surface">{getCategoryName(ad.categorySlug)}</p>
                     </div>
                     <div className="space-y-1">
                       <p className="text-label-sm font-label-sm text-on-surface-variant">{t("ads.seller")}</p>
                       <p className="text-body-sm font-body-sm text-on-surface">{ad.sellerName}</p>
                     </div>
                     <div className="space-y-1">
                       <p className="text-label-sm font-label-sm text-on-surface-variant">{t("ads.phone")}</p>
                       <p className="text-body-sm font-body-sm text-on-surface">{ad.sellerPhone}</p>
                     </div>
                     <div className="space-y-1">
                       <p className="text-label-sm font-label-sm text-on-surface-variant">{t("ads.location")}</p>
                       <p className="text-body-sm font-body-sm text-on-surface">{ad.location}</p>
                     </div>
                   </div>

                   <div className="mt-4 flex flex-wrap items-center gap-2">
                     <span className="text-label-sm font-label-sm text-on-surface-variant">{t("ads.date")}</span>
                     <span className="text-body-sm font-body-sm text-on-surface">{ad.createdAt ? formatDate(ad.createdAt, locale) : "—"}</span>
                   </div>

                   <div className="mt-5 flex flex-wrap gap-2">
                     <button
                       type="button"
                       onClick={() => {
                         setPreviewingAdId(ad.id === previewingAdId ? null : ad.id);
                         setRejectingAdId((current) => (current === ad.id ? null : current));
                         setEditingAdId((current) => (current === ad.id ? null : current));
                       }}
                       className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-label-sm font-label-sm text-on-surface transition hover:bg-surface-container-highest"
                     >
                       <Icon name={isPreviewing ? "visibility_off" : "visibility"} size={16} />
                       {t("ads.view")}
                     </button>
                     <button
                       type="button"
                       disabled={busyAdId === ad.id}
                       onClick={() => handleApprove(ad.id)}
                       className="inline-flex items-center gap-1.5 rounded-lg border-2 border-success bg-success/30 px-3 py-2 text-label-sm font-label-sm font-semibold text-success transition hover:bg-success/40 hover:border-success disabled:opacity-60"
                     >
                       <Icon name="check" size={16} />
                       {t("ads.approve")}
                     </button>
                     <button
                       type="button"
                       disabled={busyAdId === ad.id}
                       onClick={() => {
                         setRejectingAdId(ad.id === rejectingAdId ? null : ad.id);
                         setEditingAdId((current) => (current === ad.id ? null : current));
                         setPreviewingAdId((current) => (current === ad.id ? null : current));
                       }}
                       className="inline-flex items-center gap-1.5 rounded-lg border border-error text-error px-3 py-2 text-label-sm font-label-sm transition hover:bg-error/10 disabled:opacity-60"
                     >
                       <Icon name="cancel" size={16} />
                       {t("ads.reject")}
                     </button>
                     <button
                       type="button"
                       disabled={busyAdId === ad.id}
                       onClick={() => {
                         setEditingAdId(ad.id === editingAdId ? null : ad.id);
                         setRejectingAdId((current) => (current === ad.id ? null : current));
                         setPreviewingAdId((current) => (current === ad.id ? null : current));
                       }}
                       className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-label-sm font-label-sm text-on-surface transition hover:bg-surface-container-highest disabled:opacity-60"
                     >
                       <Icon name="edit" size={16} />
                       {t("ads.edit")}
                     </button>
                   </div>

                  {isPreviewing ? (
                    <div className="mt-6 rounded-3xl border border-outline-variant bg-surface-container-lowest p-6">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <p className="font-headline-sm text-headline-sm text-on-surface">{t("product.description")}</p>
                        <button
                          type="button"
                          onClick={() => setPreviewingAdId(null)}
                          className="text-on-surface-variant hover:text-on-surface"
                        >
                          <Icon name="close" size={18} />
                        </button>
                      </div>

                      <div className="grid gap-6 sm:grid-cols-[200px_minmax(0,1fr)]">
                        <div className="relative h-44 w-full overflow-hidden rounded-2xl bg-surface-container-low">
                          <Image src={primaryImage} alt={ad.title} fill sizes="200px" className="object-cover" />
                        </div>
                        <div>
                          <p className="text-body-md font-body-md text-on-surface whitespace-pre-line">
                            {ad.description ?? "—"}
                          </p>
                        </div>
                      </div>

                      {galleryImages.length > 1 && (
                        <div className="mt-4 flex flex-wrap gap-3">
                          {galleryImages.map((src, index) => (
                            <div key={`${src}-${index}`} className="relative h-20 w-20 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low">
                              <Image src={src} alt="" fill sizes="80px" className="object-cover" />
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-label-md font-label-md text-on-surface-variant">{t("ads.seller")}</p>
                          <p className="text-body-md font-body-md text-on-surface">{ad.sellerName}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-label-md font-label-md text-on-surface-variant">{t("ads.location")}</p>
                          <p className="text-body-md font-body-md text-on-surface">{ad.location}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-label-md font-label-md text-on-surface-variant">{t("ads.date")}</p>
                          <p className="text-body-md font-body-md text-on-surface">{ad.createdAt ? formatDate(ad.createdAt, locale) : "—"}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-label-md font-label-md text-on-surface-variant">{t("product.condition")}</p>
                          <p className="text-body-md font-body-md text-on-surface">
                            {t(`product.${ad.condition === "new" ? "brandNew" : ad.condition}`)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {isRejecting ? (
                    <div className="mt-6 rounded-3xl border border-outline-variant bg-white p-6 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-headline-sm text-headline-sm text-on-surface">{t("ads.rejectReason")}</p>
                        <button
                          type="button"
                          onClick={() => setRejectingAdId(null)}
                          className="text-on-surface-variant hover:text-on-surface"
                        >
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
                        <button
                          type="button"
                          disabled={busyAdId === ad.id}
                          onClick={() => handleReject(ad.id)}
                          className="inline-flex items-center gap-2 rounded-xl bg-error px-4 py-3 text-label-md font-label-md text-on-primary transition hover:brightness-110 disabled:opacity-60"
                        >
                          <Icon name="cancel" size={18} />
                          {t("ads.reject")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingAdId(null);
                            setRejectReason("");
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-3 text-label-md font-label-md text-on-surface transition hover:bg-surface-container-highest"
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {isEditing ? (
                    <div className="mt-6">
                      <PendingAdEditForm
                        ad={ad}
                        categories={categories}
                        onCancel={() => setEditingAdId(null)}
                        onSave={async (patch) => await handleSave(ad.id, patch)}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}