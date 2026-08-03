"use client";

import { useLocale, useTranslations } from "next-intl";
import { DataTable, type Column } from "@/components/dashboard/DataTable";
import { ReportStatusBadge, SeverityBadge } from "@/components/ui/StatusBadge";
import { Icon } from "@/components/ui/Icon";
import { formatDate } from "@/utils/format";
import type { Locale } from "@/i18n/routing";
import type { AdReport as Report } from "@/types";

export function ReportsTable({ reports }: { reports: Report[] }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;

  const columns: Column<Report>[] = [
    { key: "adId", header: t("reports.subject"), cell: (r) => `#${r.adId.slice(0, 8)}` },
    { key: "reporter", header: t("reports.reporter"), cell: (r) => r.reporterName },
    { key: "reason", header: t("reports.reason"), cell: (r) => r.reason },
    { key: "severity", header: t("reports.severity"), cell: (r) => <SeverityBadge severity={r.severity} /> },
    { key: "createdAt", header: t("reports.date"), cell: (r) => formatDate(r.createdAt, locale) },
    { key: "status", header: t("reports.status"), cell: (r) => <ReportStatusBadge status={r.status} /> },
    {
      key: "actions",
      header: t("common.actions"),
      cell: (r) =>
        r.status !== "resolved" ? (
          <button
            type="button"
            className="inline-flex items-center gap-xs text-primary hover:underline font-label-md"
          >
            <Icon name="task_alt" size={16} />
            {t("reports.resolve")}
          </button>
        ) : (
          <span className="text-on-surface-variant">—</span>
        ),
    },
  ];

  return <DataTable columns={columns} rows={reports} rowKey={(r) => r.id} />;
}
