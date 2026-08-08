"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { ROUTES } from "@/constants/routes";
import { Icon } from "@/components/ui/Icon";
import { AdStatusBadge } from "@/components/ui/StatusBadge";
import { PendingAdEditForm } from "@/components/dashboard/PendingAdEditForm";
import { DataTable, type Column } from "@/components/dashboard/DataTable";
import { AdActionsMenu, type AdActionItem } from "@/components/dashboard/AdActionsMenu";
import { formatPrice, formatDate } from "@/utils/format";
import { resolveCategoryName } from "@/utils/category";
import type { Category, Product } from "@/types";
import type { Locale } from "@/i18n/routing";

const STATUS_OPTIONS = [
  { value: "all", labelKey: "common.all" },
  { value: "pending", labelKey: "adStatus.pending" },
  { value: "approved", labelKey: "adStatus.approved" },
  { value: "hidden", labelKey: "adStatus.hidden" },
  { value: "rejected", labelKey: "adStatus.rejected" },
  { value: "expired", labelKey: "adStatus.expired" },
] as const;

export function AllAdsView({
  initialAds,
  categories,
}: {
  initialAds: Product[];
  categories: Category[];
}) {
  const [ads, setAds] = useState<Product[]>(initialAds);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  const [rejectingAdId, setRejectingAdId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyAdId, setBusyAdId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = useTranslations();
  const locale = useLocale() as Locale;

  const getCategoryName = useCallback(
    (slug: string) => {
      const category = categories.find((category) => category.slug === slug);
      return category ? resolveCategoryName(category, locale) : slug;
    },
    [categories, locale],
  );

  const normalizedSearch = search.trim().toLowerCase();
  const filteredAds = useMemo(() => {
    const result = ads.filter((ad) => {
      if (statusFilter !== "all" && ad.status !== statusFilter) return false;
      if (categoryFilter && ad.categorySlug !== categoryFilter) return false;
      if (!normalizedSearch) return true;

      const values = [
        ad.title,
        ad.sellerName,
        ad.sellerPhone,
        getCategoryName(ad.categorySlug),
      ];
      return values.some((value) => value?.toLowerCase().includes(normalizedSearch));
    });

    // Sort newest-first (latest createdAt on top).
    result.sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });

    return result;
  }, [ads, categoryFilter, getCategoryName, normalizedSearch, statusFilter]);

  const updateAd = (updated: Product) => {
    setAds((prev) => prev.map((ad) => (ad.id === updated.id ? updated : ad)));
  };

  const removeAd = (adId: string) => {
    setAds((prev) => prev.filter((ad) => ad.id !== adId));
  };

  const handleAction = async (adId: string, action: string, message?: string) => {
    setError(null);
    setBusyAdId(adId);
    try {
      const response = await fetch(`/api/ads/${adId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, message }),
      });
      if (!response.ok) {
        throw new Error("Failed to complete action.");
      }
      if (action === "ignoreReports") {
        removeAd(adId);
        return;
      }
      if (action === "delete") {
        removeAd(adId);
        return;
      }
      const payload = await response.json();
      if (payload?.id) {
        updateAd(payload as Product);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAdId(null);
    }
  };

  const handleApprove = async (adId: string) => {
    setError(null);
    setBusyAdId(adId);
    try {
      const response = await fetch(`/api/ads/${adId}/approve`, { method: "POST" });
      if (!response.ok) {
        throw new Error("Failed to approve ad.");
      }
      const updatedAd = (await response.json()) as Product;
      updateAd(updatedAd);
      setRejectingAdId((current) => (current === adId ? null : current));
      setEditingAdId((current) => (current === adId ? null : current));
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
      const updatedAd = (await response.json()) as Product;
      updateAd(updatedAd);
      setRejectReason("");
      setRejectingAdId(null);
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
      updateAd(updatedAd);
      setEditingAdId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAdId(null);
    }
  };

  const editingAd = ads.find((ad) => ad.id === editingAdId) ?? null;
  const rejectingAd = ads.find((ad) => ad.id === rejectingAdId) ?? null;

  // Extracted verbatim from the former inline Delete button so the action menu can reuse it.
  const handleDelete = async (adId: string) => {
    setError(null);
    setBusyAdId(adId);
    try {
      const response = await fetch(`/api/ads/${adId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Failed to delete ad.");
      }
      removeAd(adId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAdId(null);
    }
  };

  const columns: Column<Product>[] = [
    {
      key: "title",
      header: t("ads.title"),
      cell: (ad) => (
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 overflow-hidden rounded-2xl bg-surface-container-lowest">
            <Image
              src={ad.image}
              alt={ad.title}
              fill
              sizes="48px"
              className="object-cover"
              onError={(e) => { e.currentTarget.src = "/placeholder-image.svg"; }}
            />
          </div>
          <div>
            <div className="font-medium text-on-surface">{ad.title}</div>
            <div className="text-label-sm text-on-surface-variant">{ad.location}</div>
          </div>
        </div>
      ),
    },
    { key: "seller", header: t("ads.seller"), cell: (ad) => ad.sellerName },
    { key: "phone", header: t("ads.phone"), cell: (ad) => ad.sellerPhone },
    {
      key: "category",
      header: t("ads.category"),
      cell: (ad) => getCategoryName(ad.categorySlug),
    },
    {
      key: "price",
      header: t("ads.price"),
      cell: (ad) => formatPrice(ad.price, ad.currency, locale),
    },
    {
      key: "date",
      header: t("ads.date"),
      cell: (ad) => (ad.createdAt ? formatDate(ad.createdAt, locale) : "—"),
    },
    {
      key: "status",
      header: t("ads.status"),
      cell: (ad) => <AdStatusBadge status={ad.status} />,
    },
    {
      key: "actions",
      header: t("common.actions"),
      className: "w-px whitespace-nowrap text-center",
      cell: (ad) => {
        const busy = busyAdId === ad.id;
        const items: AdActionItem[] = [
          {
            key: "view",
            label: t("ads.view"),
            icon: "visibility",
            href: ROUTES.product(ad.id),
          },
          {
            key: "edit",
            label: t("ads.edit"),
            icon: "edit",
            disabled: busy,
            onClick: () => setEditingAdId((current) => (current === ad.id ? null : ad.id)),
          },
          ...(ad.status === "pending"
            ? [
                {
                  key: "approve",
                  label: t("ads.approve"),
                  icon: "check",
                  disabled: busy,
                  onClick: () => handleApprove(ad.id),
                },
                {
                  key: "reject",
                  label: t("ads.reject"),
                  icon: "cancel",
                  disabled: busy,
                  onClick: () => {
                    setRejectingAdId((current) => (current === ad.id ? null : ad.id));
                    setEditingAdId((current) => (current === ad.id ? null : current));
                  },
                },
              ]
            : []),
          {
            key: "hide",
            label: t(ad.status === "hidden" ? "ads.unhide" : "ads.hide"),
            icon: ad.status === "hidden" ? "visibility" : "visibility_off",
            disabled: busy,
            onClick: () => handleAction(ad.id, ad.status === "hidden" ? "unhide" : "hide"),
          },
          {
            key: "pin",
            label: t(ad.pinned ? "ads.unpin" : "ads.pin"),
            icon: "push_pin",
            disabled: busy,
            onClick: async () => {
              setError(null);
              setBusyAdId(ad.id);
              try {
                const response = await fetch(`/api/ads/${ad.id}/actions`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: ad.pinned ? "unpin" : "pin" }),
                });
                if (!response.ok) {
                  throw new Error("Failed to pin/unpin ad.");
                }
                const updatedAd = (await response.json()) as Product;
                updateAd(updatedAd);
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              } finally {
                setBusyAdId(null);
              }
            },
          },
          {
            key: "feature",
            label: t(ad.featured ? "ads.unfeature" : "ads.feature"),
            icon: "star",
            disabled: busy,
            onClick: () => handleAction(ad.id, ad.featured ? "unfeature" : "feature"),
          },
          {
            key: "delete",
            label: t("ads.delete"),
            icon: "delete",
            variant: "danger",
            dividerBefore: true,
            disabled: busy,
            onClick: () => handleDelete(ad.id),
          },
        ];
        return <AdActionsMenu items={items} label={t("common.actions")} />;
      },
    },
  ];

  return (
    <div className="space-y-xl">
      <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-lg">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
          <div className="space-y-3">
            <label className="text-label-sm font-label-sm text-on-surface-variant">{t("common.search")}</label>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("dashboard.searchPlaceholder")}
              className="w-full rounded-2xl border border-outline-variant bg-surface-container p-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-2">
              <span className="text-label-sm font-label-sm text-on-surface-variant">{t("ads.status")}</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-2xl border border-outline-variant bg-surface-container px-3 py-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-label-sm font-label-sm text-on-surface-variant">{t("ads.category")}</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="w-full rounded-2xl border border-outline-variant bg-surface-container px-3 py-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              >
                <option value="">{t("common.filter")}</option>
                {categories.map((option) => (
                  <option key={option.slug} value={option.slug}>
                    {resolveCategoryName(option, locale)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setCategoryFilter("");
              }}
              className="rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-label-md font-label-md text-on-surface transition hover:bg-surface-container-highest"
            >
              {t("common.reset")}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-3xl border border-error bg-error-container/10 p-lg text-error">{error}</div>
      ) : null}

      {editingAd ? (
        <PendingAdEditForm
          ad={editingAd}
          categories={categories}
          onCancel={() => setEditingAdId(null)}
          onSave={async (patch) => await handleSave(editingAd.id, patch)}
        />
      ) : null}

      {rejectingAd ? (
        <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-headline-sm font-headline-sm text-on-surface">{t("ads.rejectReason")}</h2>
              <p className="mt-2 text-body-md text-on-surface-variant">{rejectingAd.title}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRejectingAdId(null);
                setRejectReason("");
              }}
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
              disabled={busyAdId === rejectingAd.id}
              onClick={() => handleReject(rejectingAd.id)}
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

      <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-lg">
        <DataTable columns={columns} rows={filteredAds} rowKey={(ad) => ad.id} />
      </div>
    </div>
  );
}
