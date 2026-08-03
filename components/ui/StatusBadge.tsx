import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import type { ReportStatus, ReportSeverity, AdStatus } from "@/types";

const reportTone: Record<ReportStatus, Parameters<typeof Badge>[0]["tone"]> = {
  open: "error",
  investigating: "warning",
  resolved: "success",
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const t = useTranslations("reportStatus");
  return <Badge tone={reportTone[status]}>{t(status)}</Badge>;
}

const severityTone: Record<ReportSeverity, Parameters<typeof Badge>[0]["tone"]> = {
  low: "neutral",
  medium: "warning",
  high: "error",
};

export function SeverityBadge({ severity }: { severity: ReportSeverity }) {
  const t = useTranslations("severity");
  return <Badge tone={severityTone[severity]}>{t(severity)}</Badge>;
}

const adTone: Record<AdStatus, Parameters<typeof Badge>[0]["tone"]> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
  hidden: "neutral",
  expired: "neutral",
  sold: "secondary",
  deleted: "error",
};

export function AdStatusBadge({ status }: { status: AdStatus }) {
  const t = useTranslations("adStatus");
  return <Badge tone={adTone[status]}>{t(status)}</Badge>;
}
