import { setRequestLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/serverAuth";
import { ProfileTabsView } from "@/components/profile/ProfileTabsView";
import { getUserProfile } from "@/services/auth";
import { adRepository } from "@/services/repositories/adRepository";
import type { Locale } from "@/i18n/routing";

export default async function AccountProfilePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Get the current user's session
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  // Get the current user's profile with username fields
  const userProfile = await getUserProfile(user.id);

  // Get user's ads
  const ads = await adRepository.listByOwner(user.id);

  return <ProfileTabsView user={userProfile} ads={ads} locale={locale} />;
}
