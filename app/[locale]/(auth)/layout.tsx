import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { BrandPanel } from "@/components/auth/BrandPanel";
import type { Locale } from "@/i18n/routing";

export default async function AuthLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      {/* Branding column — hidden on mobile, visible on lg screens */}
      <BrandPanel />

      {/* Form column — full width on mobile, half on lg */}
      <main className="relative flex flex-col min-h-screen bg-gray-50/50">
        {/* Language switcher — top right */}
        <div className="absolute top-4 end-4 z-10">
          <LanguageSwitcher />
        </div>

        {/* Content centered */}
        <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
