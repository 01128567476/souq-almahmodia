import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getProductsByCategory } from "@/services/products";
import { categoryRepository } from "@/services/repositories/categoryRepository";
import { resolveCategoryName } from "@/utils/category";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ProductGrid } from "@/components/marketplace/ProductGrid";
import { ROUTES } from "@/constants/routes";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/utils/cn";
import type { Locale } from "@/i18n/routing";


// Force dynamic rendering — no static generation
export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  return [];
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const [category, products] = await Promise.all([
    categoryRepository.getBySlug(slug),
    getProductsByCategory(slug),
  ]);
  if (!category) notFound();

  const name = resolveCategoryName(category, locale);

  return (
    <div className="max-w-7xl mx-auto px-margin py-xl">
      <Breadcrumbs
        items={[{ label: t("nav.marketplace"), href: ROUTES.home }, { label: name }]}
      />

      <div className="flex items-center gap-lg mt-lg mb-xl">
        <div
          className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center",
            category.color,
          )}
        >
          <Icon name={category.icon} size={32} />
        </div>
        <div>
          <h1 className="text-headline-lg font-headline-lg text-on-surface">{name}</h1>
          <p className="text-body-md font-body-md text-on-surface-variant">
            {products.length} {t("common.itemsFound")}
          </p>
        </div>
      </div>

      {products.length > 0 ? (
        <ProductGrid products={products} />
      ) : (
        <EmptyState
          icon="inventory_2"
          title={t("search.noResults")}
          description={t("search.noResultsSub")}
        />
      )}
    </div>
  );
}
