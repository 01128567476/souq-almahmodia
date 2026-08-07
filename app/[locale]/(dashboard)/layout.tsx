import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getViewerRole } from "@/lib/serverAuth";
import { hasAtLeast } from "@/constants/roles";
import { Sidebar } from "@/components/layout/Sidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import type { Locale } from "@/i18n/routing";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Defence in depth: middleware guards these routes too, but re-check on the server.
  const role = await getViewerRole();
  if (!hasAtLeast(role, "admin")) {
    redirect({ href: "/login", locale });
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader />
        <main className="flex-1 p-margin overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
