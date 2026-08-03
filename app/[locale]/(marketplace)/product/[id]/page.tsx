import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getProductById, getProductsByCategory } from "@/services/products";
import { categoryRepository } from "@/services/repositories/categoryRepository";
import { resolveCategoryName } from "@/utils/category";
import { ROUTES } from "@/constants/routes";
import { getUserProfile } from "@/services/auth";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ProductGrid } from "@/components/marketplace/ProductGrid";
import { ImageGallery } from "@/components/marketplace/ImageGallery";
import { PinBadge } from "@/components/marketplace/PinBadge";
import { AdEngagementPanel } from "@/components/engagement/AdEngagementPanel";
import { Icon } from "@/components/ui/Icon";
import { formatPrice, phoneDigits } from "@/utils/format";
import type { Locale } from "@/i18n/routing";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const product = await getProductById(id);
  if (!product) notFound();

  const [category, related] = await Promise.all([
    categoryRepository.getBySlug(product.categorySlug),
    getProductsByCategory(product.categorySlug),
  ]);
  const categoryName = category
    ? resolveCategoryName(category, locale)
    : product.categorySlug;
  const relatedProducts = related.filter((p) => p.id !== product.id).slice(0, 4);

  const conditionKey = product.condition === "new" ? "brandNew" : product.condition;
  const gallery = product.images?.length ? product.images : [product.image];
  const waDigits = phoneDigits(product.sellerPhone);

  // Map seller names to usernames for demo users without ownerId
  const SELLER_NAME_TO_USERNAME: Record<string, string> = {
    "Layla M.": "layla_m",
    "Hassan A.": "hassan_a",
    "Omar K.": "omar_k",
    "Sara N.": "sara_n",
    "Faisal R.": "faisal_r",
    "Mona T.": "mona_t",
  };

  // Resolve seller profile: try ownerId first, then seller name mapping
  let sellerProfile = product.ownerId ? await getUserProfile(product.ownerId) : null;
  let sellerProfileUrl: string | null = sellerProfile?.username ? `/u/${sellerProfile.username}` : null;

  // If no ownerId, try to resolve by seller name
  if (!sellerProfileUrl && product.sellerName) {
    const username = SELLER_NAME_TO_USERNAME[product.sellerName];
    if (username) {
      sellerProfileUrl = `/u/${username}`;
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-margin py-xl">
      <Breadcrumbs
        items={[
          { label: t("nav.marketplace"), href: ROUTES.search },
          { label: categoryName, href: category ? ROUTES.category(category.slug) : undefined },
          { label: product.title },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2xl mt-lg">
        <ImageGallery images={gallery} alt={product.title} />

        <div className="flex flex-col">
          <div className="flex items-center gap-sm mb-md">
            <span className="text-label-md font-label-md text-on-surface-variant px-3 py-1 bg-surface-container rounded-full">
              {categoryName}
            </span>
            <span className="text-label-md font-label-md text-primary px-3 py-1 bg-primary-fixed rounded-full">
              {t(`product.${conditionKey}`)}
            </span>
          </div>

          <h1 className="text-headline-lg font-headline-lg text-on-surface mb-sm">
            {product.title}
          </h1>

          <PinBadge pinned={product.pinned === true} size="md" />

          <div className="flex items-center gap-md text-body-sm font-body-sm text-on-surface-variant mb-lg">
            <span className="flex items-center gap-xs">
              <Icon name="location_on" size={18} />
              {product.location}
            </span>
            <span className="flex items-center gap-xs">
              <Icon name="schedule" size={18} />
              {t("product.postedAgo", { hours: product.postedAgoHours })}
            </span>
          </div>

          <p className="text-display-lg font-display-lg text-primary mb-xl">
            {formatPrice(product.price, product.currency, locale)}
          </p>

          {product.description && (
            <div className="mb-xl">
              <h2 className="text-headline-md font-headline-md text-on-surface mb-sm">
                {t("product.description")}
              </h2>
              <p className="text-body-md font-body-md text-on-surface-variant whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg mb-xl">
            <div className="flex items-center gap-md">
              <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-primary">
                <Icon name="storefront" />
              </div>
              <div>
                <p className="text-label-md font-label-md text-on-surface-variant">
                  {t("product.seller")}
                </p>
                {sellerProfileUrl ? (
                  <a
                    href={sellerProfileUrl}
                    className="font-headline-md text-body-md text-primary hover:underline cursor-pointer"
                  >
                    {product.sellerName}
                  </a>
                ) : (
                  <p className="font-headline-md text-body-md text-on-surface">
                    {product.sellerName}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-md mt-auto">
            <a
              href={`tel:${product.sellerPhone}`}
              className="flex-1 flex items-center justify-center gap-sm py-md bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold hover:brightness-110 active:scale-[0.98] transition-all"
            >
              <Icon name="call" size={20} />
              {t("product.call")}
            </a>
            <a
              href={`https://wa.me/${waDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-sm py-md px-lg border border-outline-variant rounded-xl font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors"
            >
              <Icon name="chat" size={20} />
              {t("product.whatsapp")}
            </a>
          </div>
        </div>
      </div>

      <AdEngagementPanel adId={product.id} advertisement={product} />

      {relatedProducts.length > 0 && (
        <section className="mt-2xl">
          <h2 className="text-headline-lg font-headline-lg text-on-surface mb-lg">
            {t("product.relatedProducts")}
          </h2>
          <ProductGrid products={relatedProducts} />
        </section>
      )}
    </div>
  );
}