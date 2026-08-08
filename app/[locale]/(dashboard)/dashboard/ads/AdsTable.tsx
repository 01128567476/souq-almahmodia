"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { DataTable, type Column } from "@/components/dashboard/DataTable";
import { AdStatusBadge } from "@/components/ui/StatusBadge";
import { formatPrice, formatDate } from "@/utils/format";
import type { Locale } from "@/i18n/routing";
import type { Product } from "@/types";

export function AdsTable({ ads }: { ads: Product[] }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;

  const columns: Column<Product>[] = [
    {
      key: "title",
      header: t("ads.title"),
      cell: (ad) => (
        <div className="flex items-center gap-md">
           <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-surface-container-highest">
             <Image src={ad.image} alt={ad.title} fill className="object-cover" onError={(e) => { e.currentTarget.src = "/placeholder-image.svg"; }} />
           </div>
          <span className="font-medium text-on-surface">{ad.title}</span>
        </div>
      ),
    },
    { key: "seller", header: t("ads.seller"), cell: (ad) => ad.sellerName },
    {
      key: "price",
      header: t("ads.price"),
      cell: (ad) => formatPrice(ad.price, ad.currency, locale),
    },
    { key: "category", header: t("ads.category"), cell: (ad) => ad.categorySlug },
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
  ];

  return <DataTable columns={columns} rows={ads} rowKey={(ad) => ad.id} />;
}