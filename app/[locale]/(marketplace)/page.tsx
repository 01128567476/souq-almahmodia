import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { getApprovedProducts } from "@/services/products";
import { categoryRepository } from "@/services/repositories/categoryRepository";
import { HeroSearch } from "@/components/marketplace/HeroSearch";
import { CategoryCard } from "@/components/marketplace/CategoryCard";
import { ProductGrid } from "@/components/marketplace/ProductGrid";
import { SearchView } from "@/components/marketplace/SearchView";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/i18n/routing";

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { q: searchQuery } = await searchParams;
  const [products, categories] = await Promise.all([
    getApprovedProducts(),
    categoryRepository.listVisible(),
  ]);

  // If search query exists, show search results instead of marketplace
  if (searchQuery && searchQuery.trim()) {
    return (
      <div className="min-h-screen bg-surface-container-lowest">
        <SearchView products={products} query={searchQuery} />
      </div>
    );
  }

  return (
    <>
      <section className="hero-gradient pt-2xl pb-xl px-margin">
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
          <h1 className="text-display-lg font-display-lg max-w-4xl mb-lg">
            {t("home.heroTitle")}
          </h1>
          <p className="text-body-lg font-body-lg text-on-surface-variant max-w-2xl mb-2xl">
            {t("home.heroSubtitle")}
          </p>
          <HeroSearch products={products} />
        </div>
      </section>

      <section className="py-2xl px-margin max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-xl">
          <div>
            <h2 className="text-headline-lg font-headline-lg mb-2">
              {t("home.exploreCategories")}
            </h2>
            <p className="text-body-md font-body-md text-on-surface-variant">
              {t("home.exploreCategoriesSub")}
            </p>
          </div>
          <Link
            href={ROUTES.search}
            className="text-primary font-label-md text-label-md flex items-center gap-1 hover:underline"
          >
            {t("common.viewAll")}
            <Icon name="arrow_forward" size={16} className="rtl:rotate-180" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-lg">
          {categories.map((category) => (
            <CategoryCard key={category.slug} category={category} />
          ))}
        </div>
      </section>

      <section className="py-2xl bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-margin">
          <div className="flex justify-between items-end mb-xl">
            <h2 className="text-headline-lg font-headline-lg">{t("home.newArrivals")}</h2>
            <Link
              href={ROUTES.search}
              className="text-primary font-label-md text-label-md flex items-center gap-1 hover:underline"
            >
              {t("common.viewAll")}
              <Icon name="arrow_forward" size={16} className="rtl:rotate-180" />
            </Link>
          </div>
          <ProductGrid products={products} />
        </div>
      </section>

      <section className="py-2xl px-margin">
        <div className="max-w-7xl mx-auto rounded-3xl bg-primary text-on-primary px-margin py-2xl flex flex-col items-center text-center gap-lg">
          <h2 className="text-headline-lg font-headline-lg max-w-2xl">
            {t("brand.tagline")}
          </h2>
          <Link
            href={ROUTES.register}
            className="bg-on-primary text-primary px-8 py-4 rounded-lg font-label-md text-label-md font-bold hover:opacity-90 active:scale-95 transition-all"
          >
            {t("home.cta")}
          </Link>
        </div>
      </section>
    </>
  );
}