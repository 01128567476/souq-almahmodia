"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/utils/cn";

export function SearchEmptyState({
  query = "",
  onClear,
  className,
}: {
  query?: string;
  onClear?: () => void;
  className?: string;
}) {
  const t = useTranslations();

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className,
      )}
    >
      <div className="mb-lg flex h-20 w-20 items-center justify-center rounded-full bg-surface-container-low">
        <Icon name="search_off" size={32} className="text-outline" />
      </div>
      <h3 className="mb-sm text-headline-sm text-on-surface">
        {t("search.noResultsTitle")}
      </h3>
          <p className="mb-md max-w-md text-body-md font-body-md text-on-surface-variant">
        {query ? (
          <>{t("search.noResultsSub")} <span className="font-bold text-on-surface">{"\"" + query + "\""}</span></>
        ) : (
          t("search.noResultsSub")
        )}
      </p>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg bg-primary px-6 py-2.5 font-label-md text-label-md font-bold text-on-primary transition-all hover:brightness-110"
        >
          {t("search.showAll")}
        </button>
      )}
    </div>
  );
}