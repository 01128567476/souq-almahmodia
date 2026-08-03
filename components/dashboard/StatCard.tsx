import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/utils/cn";
import type { StatCard as StatCardData } from "@/types";

const toneStyles: Record<StatCardData["tone"], string> = {
  primary: "bg-primary-fixed text-primary",
  secondary: "bg-secondary-container text-on-secondary-container",
  tertiary: "bg-tertiary-fixed text-tertiary",
  error: "bg-error-container text-error",
};

export function StatCard({ stat }: { stat: StatCardData }) {
  const t = useTranslations("dashboard.stats");
  const positive = stat.delta.trim().startsWith("+");

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-lg shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-md">
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            toneStyles[stat.tone],
          )}
        >
          <Icon name={stat.icon} size={24} />
        </div>
        <span
          className={cn(
            "text-label-md font-label-md font-bold px-2 py-1 rounded-full",
            positive ? "bg-green-100 text-green-700" : "bg-error-container text-error",
          )}
        >
          {stat.delta}
        </span>
      </div>
      <p className="text-headline-lg font-headline-lg text-on-surface">{stat.value}</p>
      <p className="text-body-sm font-body-sm text-on-surface-variant mt-xs">
        {t(stat.labelKey)}
      </p>
    </div>
  );
}
