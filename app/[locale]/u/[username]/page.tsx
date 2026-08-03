import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getProductsByOwner, searchProducts, getApprovedProducts } from "@/services/products";
import { getUserByUsername } from "@/services/auth";
import { resolveCategoryName } from "@/utils/category";
import { ROUTES } from "@/constants/routes";
import { ProductGrid } from "@/components/marketplace/ProductGrid";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Icon } from "@/components/ui/Icon";
import { formatPrice } from "@/utils/format";
import type { Locale } from "@/i18n/routing";
import type { Product } from "@/types";

/** Map usernames to seller names used in mock ad data */
const USERNAME_TO_SELLER_NAME: Record<string, string> = {
  layla_m: "Layla M.",
  hassan_a: "Hassan A.",
  omar_k: "Omar K.",
  sara_n: "Sara N.",
  faisal_r: "Faisal R.",
  mona_t: "Mona T.",
};

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ locale: Locale; username: string }>;
}) {
  const { locale, username } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("profile");

  // Get user profile by username
  const user = await getUserByUsername(username);
  if (!user) notFound();

  // Get user's approved ads
  // First try by ownerId (for users with ownerId set)
  let publicAds: Product[] = (await getProductsByOwner(user.id))
    .filter((ad) => ad.status === "approved");

  // If no ads by ownerId, try matching by sellerName (for mock sellers)
  if (publicAds.length === 0) {
    const sellerName = USERNAME_TO_SELLER_NAME[username];
    if (sellerName) {
      const allApproved = await getApprovedProducts();
      publicAds = allApproved.filter((ad) => ad.sellerName === sellerName);
    }
  }

  // Get category names for ads
  const adsWithCategoryNames = publicAds.map((ad) => ({
    ...ad,
    categoryName: resolveCategoryName(
      { slug: ad.categorySlug, name: ad.categorySlug, nameEn: ad.categorySlug, nameAr: ad.categorySlug } as any,
      locale
    ),
  }));

  return (
    <div className="max-w-7xl mx-auto px-margin py-xl">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: t("nav.marketplace") || "Marketplace", href: ROUTES.search },
          { label: user.displayName || username },
        ]}
      />

      {/* User Profile Header */}
      <div className="bg-white border border-outline-variant rounded-2xl p-xl mt-lg mb-xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-lg">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-full bg-primary-fixed flex items-center justify-center text-primary flex-shrink-0">
            <Icon name="person" size={40} />
          </div>

          {/* User Info */}
          <div className="flex-1 text-center sm:text-start">
            <h1 className="text-headline-lg font-headline-lg text-on-surface mb-sm">
              {user.displayName || username}
            </h1>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-sm text-body-sm text-on-surface-variant">
              <span className="flex items-center gap-xs">
                <Icon name="badge" size={18} />
                @{user.username}
              </span>
              <span className="flex items-center gap-xs">
                <Icon name="calendar_today" size={18} />
                Member since {new Date(user.joinedAt).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", { year: "numeric", month: "long" })}
              </span>
              <span className="flex items-center gap-xs">
                <Icon name="storefront" size={18} />
                {publicAds.length} {publicAds.length === 1 ? "إعلان" : "إعلانات"}
              </span>
            </div>
          </div>

          {/* Contact Button */}
          <a
            href={`tel:${user.phone || ""}`}
            className="flex items-center justify-center gap-sm py-md px-xl bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <Icon name="call" size={20} />
            {t("contact") || "اتصال"}
          </a>
        </div>
      </div>

      {/* User's Ads */}
      <section>
        <h2 className="text-headline-md font-headline-md text-on-surface mb-lg">
          {t("listings") || "إعلانات هذا البائع"}
        </h2>

        {publicAds.length > 0 ? (
          <ProductGrid products={adsWithCategoryNames} />
        ) : (
          <div className="bg-white border border-outline-variant rounded-2xl p-xl text-center">
            <Icon name="inbox" size={48} className="text-outline mb-md" />
            <p className="text-body-md text-on-surface-variant">
              {t("noListings") || "لا توجد إعلانات حالياً"}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}