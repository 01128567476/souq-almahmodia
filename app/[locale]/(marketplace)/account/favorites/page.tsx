import { setRequestLocale, getTranslations } from "next-intl/server";
import { getApprovedProducts } from "@/services/products";
import { FavoritesView } from "./FavoritesView";
import type { Locale } from "@/i18n/routing";

export default async function AccountFavoritesPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account");

  // Pass the full approved catalogue; the client view filters to the ads the
  // viewer has actually favorited, using the shared engagement stats as the
  // single source of truth (so hearts and the list can never disagree).
  const products = await getApprovedProducts();

  return (
    <div>
      <header className="mb-xl">
        <h2 className="text-headline-md font-headline-md text-on-surface">{t("favorites")}</h2>
      </header>
      <FavoritesView products={products} />
    </div>
  );
}
