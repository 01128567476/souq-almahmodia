"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "@/components/ui/Icon";
import type { Role } from "@/types";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { cn } from "@/utils/cn";

interface DrawerLink {
  href: string;
  label: string;
  icon: string;
  /** Only match this exact path when highlighting the active item. */
  exact?: boolean;
}

/**
   * Full-screen mobile navigation drawer.
   *
   * Rendered through a portal to <body> so it escapes the sticky header's
   * `backdrop-filter` (glass-nav) — an element with backdrop-filter becomes the
   * containing block for `position: fixed` descendants, which would otherwise trap
   * the overlay inside the header and let page content show through.
   */
  export function MobileNav({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  }) {
    const t = useTranslations();
    const { isAuthenticated, user } = useAuth();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    // Determine if user is admin
    const isAdmin = user?.role === "admin";

  // Portals need a DOM target, which only exists after mount (avoids SSR mismatch).
  useEffect(() => setMounted(true), []);

  // Close on route change.
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  // Lock body scroll and close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const primaryLinks: DrawerLink[] = [
    { href: ROUTES.home, label: t("nav.browse"), icon: "storefront" },
    ...(isAuthenticated
      ? [
          { href: ROUTES.accountAds, label: t("account.myAds"), icon: "sell" },
          {
            href: ROUTES.accountFavorites,
            label: t("account.favorites"),
            icon: "favorite",
            exact: true,
          },
          // Admins keep every user link and gain the dashboard entry. This list
          // must stay in step with Navbar's — when the drawer showed /account
          // links while the header badge read "admin", the two disagreed.
          ...(isAdmin
            ? [
                {
                  href: ROUTES.dashboard,
                  label: t("dashboard.title"),
                  icon: "shield",
                  exact: true,
                },
              ]
            : []),
        ]
      : []),
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const itemClass = (active: boolean) =>
    cn(
      "flex items-center gap-md px-md py-sm rounded-xl font-label-md text-label-md transition-colors",
      active
        ? "bg-primary-fixed text-primary"
        : "text-on-surface-variant hover:bg-surface-container-low",
    );

  return createPortal(
    <div
      className={cn(
        "md:hidden fixed inset-0 z-[100] transition-opacity duration-200",
        open ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!open}
    >
      {/* Scrim */}
      <button
        type="button"
        aria-label={t("common.close")}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-scrim/50"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("common.menu")}
        className={cn(
          "absolute inset-y-0 start-0 flex h-full w-80 max-w-[85%] flex-col bg-surface-container-lowest shadow-2xl transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-outline-variant px-margin py-md">
          <span className="text-headline-md font-headline-md font-bold text-on-surface">
            {t("brand.name")}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="-me-2 p-2 text-on-surface-variant transition-colors hover:text-primary"
            aria-label={t("common.close")}
          >
            <Icon name="close" />
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-xs overflow-y-auto custom-scrollbar px-md py-lg">
          {primaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href, link.exact) ? "page" : undefined}
              className={itemClass(isActive(link.href, link.exact))}
            >
              <Icon name={link.icon} size={20} />
              {link.label}
            </Link>
          ))}

          <Link
            href={ROUTES.accountAdNew}
            className="mt-sm flex items-center gap-md rounded-xl bg-primary px-md py-sm font-label-md text-label-md font-bold text-on-primary transition-all hover:brightness-110"
          >
            <Icon name="add_circle" size={20} />
            {t("nav.postAd")}
          </Link>

          <div className="my-md h-px bg-outline-variant" />

          <Link
            href={isAuthenticated ? ROUTES.accountNotifications : ROUTES.login}
            className={itemClass(
              isAuthenticated && isActive(ROUTES.accountNotifications),
            )}
          >
            <Icon name="notifications" size={20} />
            {t("common.notifications")}
          </Link>
          {isAuthenticated && (
            <Link
              href={ROUTES.accountProfile}
              aria-current={isActive(ROUTES.accountProfile) ? "page" : undefined}
              className={itemClass(isActive(ROUTES.accountProfile))}
            >
              <Icon name="person" size={20} />
              {t("account.profile")}
            </Link>
          )}
        </nav>

        <div className="flex flex-col gap-md border-t border-outline-variant px-md py-lg">
          {/* Language switcher — full-width button matching logout */}
          <div className="rounded-lg border border-outline-variant bg-surface-container-lowest">
            <div className="flex items-center py-2.5 px-4">
              <LanguageSwitcher />
            </div>
          </div>
          {isAuthenticated ? (
            <>
              {/* Role switcher — full-width button matching logout */}
              <div className="rounded-lg border border-outline-variant bg-surface-container-lowest">
                <RoleSwitcher />
              </div>
              {/* Divider before logout */}
              <div className="h-px bg-outline-variant my-xs" />
              {/* Logout — always last, uses block variant */}
              <LogoutButton variant="block" />
            </>
          ) : (
            <div className="flex flex-col gap-sm">
              <Link
                href={ROUTES.login}
                className="w-full rounded-lg border border-outline-variant px-4 py-2.5 text-center font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low"
              >
                {t("common.login")}
              </Link>
              <Link
                href={ROUTES.register}
                className="w-full rounded-lg bg-primary-container px-4 py-2.5 text-center font-label-md text-label-md text-on-primary-container transition-all hover:opacity-90"
              >
                {t("common.listItem")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
