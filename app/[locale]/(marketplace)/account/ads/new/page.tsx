import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { AdForm } from "@/components/account/AdForm";
import { categoryRepository } from "@/services/repositories/categoryRepository";
import { getUserProfile } from "@/services/auth";
import { getCurrentUser } from "@/lib/serverAuth";
import type { Locale } from "@/i18n/routing";

export default async function NewAdPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Get the current user's session
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect({ href: "/", locale });
    return null;
  }

  // Check if user has a username before allowing ad creation
  const user = await getUserProfile(currentUser.id);
  if (!user?.username) {
    // Redirect to username setup page
    redirect({ href: "/username-setup", locale });
    return null; // TypeScript needs this since redirect doesn't return never
  }

  const t = await getTranslations("ads");
  const categories = await categoryRepository.listVisible();

  return (
    <div>
      <header className="mb-xl">
        <h2 className="text-headline-md font-headline-md text-on-surface">{t("createTitle")}</h2>
        <p className="text-body-md font-body-md text-on-surface-variant mt-xs">
          {t("createSubtitle")}
        </p>
      </header>
      <AdForm mode="create" categories={categories} />
    </div>
  );
}