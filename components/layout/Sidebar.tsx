"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { DASHBOARD_NAV, type NavItem } from "@/constants/navigation";
import { useAuth } from "@/context/AuthContext";
import { useActiveRoute } from "@/hooks/useActiveRoute";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/utils/cn";

export function Sidebar() {
  const t = useTranslations();
  const router = useRouter();
  const { logout } = useAuth();
  const { isActive } = useActiveRoute();

  return (
    <aside className="hidden md:flex flex-col h-screen sticky top-0 w-64 bg-surface border-e border-outline-variant py-lg px-md gap-sm z-50 shrink-0">
      <Link href={ROUTES.dashboard} className="flex items-center gap-sm mb-xl px-sm">
        <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center text-on-primary-container">
          <Icon name="shield" style={{ fontVariationSettings: "'FILL' 1" }} />
        </div>
        <div>
          <h2 className="font-headline-md text-headline-md font-bold text-primary leading-tight">
            {t("brand.name")}
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {t("dashboard.nav.admin")}
          </p>
        </div>
      </Link>

      <nav className="flex-1 flex flex-col gap-xs overflow-y-auto custom-scrollbar">
        {DASHBOARD_NAV.map((item) => (
          <NavEntry key={item.href} item={item} isActive={isActive} t={t} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-xs pt-lg border-t border-outline-variant">
        <Link
          href={ROUTES.dashboardSettings}
          className="flex items-center gap-md py-sm px-md text-on-surface-variant hover:bg-surface-container rounded-lg transition-all"
        >
          <Icon name="settings" />
          <span className="font-label-md text-label-md">{t("dashboard.nav.settings")}</span>
        </Link>
        <button
          type="button"
          onClick={async () => {
            await logout();
            router.push(ROUTES.home);
          }}
          className="flex items-center gap-md py-sm px-md text-on-surface-variant hover:bg-surface-container rounded-lg transition-all text-start"
        >
          <Icon name="logout" className="text-error" />
          <span className="font-label-md text-label-md">{t("common.logout")}</span>
        </button>
      </div>
    </aside>
  );
}

function NavEntry({
  item,
  isActive,
  t,
}: {
  item: NavItem;
  isActive: (href: string, exact?: boolean) => boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const active = isActive(item.href, item.exact);

  if (item.children?.length) {
    const parentActive = active || item.children.some((c) => isActive(c.href));
    return (
      <div className="flex flex-col">
        <Link
          href={item.href}
          aria-current={parentActive ? "page" : undefined}
          className={cn(
            "flex items-center gap-md py-sm px-md rounded-e-lg transition-all duration-200",
            parentActive
              ? "bg-secondary-container text-on-secondary-container border-s-4 border-primary"
              : "text-on-surface-variant hover:bg-surface-container border-s-4 border-transparent",
          )}
        >
          <Icon name={item.icon} />
          <span className="font-label-md text-label-md">
            {t(`dashboard.nav.${item.labelKey}`)}
          </span>
        </Link>
        <div className="flex flex-col gap-xs ps-8 mt-xs">
          {item.children.map((child) => {
            const childActive = isActive(child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                aria-current={childActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-sm py-xs px-md rounded-lg transition-all duration-200",
                  childActive
                    ? "bg-primary-fixed text-on-surface font-medium"
                    : "text-on-surface-variant hover:bg-surface-container",
                )}
              >
                <Icon name={child.icon} size={18} />
                <span className="font-label-md text-label-md">
                  {t(`dashboard.nav.${child.labelKey}`)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-md py-sm px-md rounded-e-lg transition-all duration-200",
        active
          ? "bg-secondary-container text-on-secondary-container border-s-4 border-primary"
          : "text-on-surface-variant hover:bg-surface-container border-s-4 border-transparent",
      )}
    >
      <Icon name={item.icon} />
      <span className="font-label-md text-label-md">
        {t(`dashboard.nav.${item.labelKey}`)}
      </span>
    </Link>
  );
}