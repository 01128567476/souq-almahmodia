"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "@/components/ui/Icon";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";

export function DashboardHeader() {
  const t = useTranslations();
  const { user } = useAuth();

  return (
    <header className="w-full sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-outline-variant shadow-sm px-margin h-16 flex justify-between items-center">
      <div className="flex items-center gap-lg">
        <div className="relative hidden lg:block">
          <Icon
            name="search"
            className="absolute start-3 top-1/2 -translate-y-1/2 text-outline"
          />
          <input
            className="ps-10 pe-4 py-2 bg-surface-container-low border border-outline-variant rounded-xl w-64 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            placeholder={t("dashboard.searchPlaceholder")}
            type="text"
          />
        </div>
      </div>
      <div className="flex items-center gap-md">
        <LanguageSwitcher variant="dark" />
        <RoleSwitcher />
        <Link
          href={ROUTES.profile}
          className="flex items-center gap-sm cursor-pointer hover:bg-surface-container-low p-1.5 rounded-xl transition-colors"
        >
          {user && (
            <div className="text-end hidden sm:block">
              <p className="font-label-md text-label-md font-bold text-on-surface">
                {user.name}
              </p>
              <p className="text-[10px] text-outline">
                {user.role ?? ""}
              </p>
            </div>
          )}
          <Icon name="account_circle" size={32} className="text-primary" />
        </Link>
        <Link
          href={ROUTES.notifications}
          className="p-2 rounded-full hover:bg-surface-container-low text-on-surface-variant transition-colors relative"
          aria-label={t("common.notifications")}
        >
          <Icon name="notifications" />
          <span className="absolute top-1.5 end-1.5 w-2 h-2 bg-error rounded-full border-2 border-surface" />
        </Link>
      </div>
    </header>
  );
}