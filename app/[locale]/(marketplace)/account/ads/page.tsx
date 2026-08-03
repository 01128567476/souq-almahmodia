import { setRequestLocale } from "next-intl/server";
import { getProductsByOwner } from "@/services/products";
import { getCurrentUser } from "@/lib/serverAuth";
import { MyAdsView } from "./MyAdsView";
import type { Locale } from "@/i18n/routing";

export default async function AccountAdsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const ads = await getProductsByOwner(user.id);
  return <MyAdsView ads={ads} locale={locale} />;
}
