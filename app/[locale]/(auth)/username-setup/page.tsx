import { setRequestLocale } from "next-intl/server";
import { UsernameSetupView } from "@/components/auth/UsernameSetupView";
import type { Locale } from "@/i18n/routing";

/**
 * First-time username creation page.
 * Shown to users who log in but have no username yet.
 * They can browse everything but cannot post ads until they create one.
 */
export default async function UsernameSetupPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <UsernameSetupView />;
}