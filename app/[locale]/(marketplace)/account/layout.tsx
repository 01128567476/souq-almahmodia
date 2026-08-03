import type { ReactNode } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getServerRole } from "@/lib/cookies";
import { hasAtLeast } from "@/constants/roles";
import { AccountNav } from "./AccountNav";
import type { Locale } from "@/i18n/routing";

export default async function AccountLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Defence in depth: middleware guards /account too, but re-check on the server.
  const role = await getServerRole();
  if (!hasAtLeast(role, "user")) {
    redirect({ href: "/login", locale });
  }

  const t = await getTranslations("account");

  return (
    <div className="max-w-6xl mx-auto px-margin py-xl">
      <h1 className="text-headline-lg font-headline-lg text-on-surface mb-xl">{t("title")}</h1>
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-xl">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
