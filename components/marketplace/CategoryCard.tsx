import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { Icon } from "@/components/ui/Icon";
import { resolveCategoryName } from "@/utils/category";
import { cn } from "@/utils/cn";
import type { Locale } from "@/i18n/routing";
import type { Category } from "@/types";

export function CategoryCard({ category }: { category: Category }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;

  return (
    <Link
      href={ROUTES.category(category.slug)}
      className="group flex flex-col items-center justify-center gap-md p-lg bg-surface-container-lowest rounded-2xl border border-outline-variant hover:border-primary hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
    >
      <div
        className={cn(
          "w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
          category.color,
        )}
      >
        <Icon name={category.icon} size={32} />
      </div>
      <div className="text-center">
        <h3 className="font-headline-md text-body-md text-on-surface">
          {resolveCategoryName(category, locale)}
        </h3>
        <p className="text-body-sm font-body-sm text-on-surface-variant">
          {category.count.toLocaleString()} {t("common.results")}
        </p>
      </div>
    </Link>
  );
}
