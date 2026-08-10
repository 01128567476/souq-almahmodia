"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "@/components/ui/Icon";
import { ActiveLink } from "@/components/layout/ActiveLink";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import { MobileNav } from "@/components/layout/MobileNav";
import { LogoutButton } from "@/components/auth/LogoutButton";

export function Navbar() {
  const t = useTranslations();
  const { isAuthenticated, user, isLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Stable identity so MobileNav's route-change effect doesn't re-fire every render.
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Browse is public; My Ads and Favorites become nav items once signed in.
  // Admins get everything a user gets, plus a Dashboard link — /account is not
  // admin-forbidden, so these hrefs are the same for both roles.
  const isAdmin = user?.role === "admin";
  const navLinks = [
    { href: ROUTES.home, label: t("nav.browse") },
    ...(isAuthenticated
      ? [
          { href: ROUTES.accountAds, label: t("account.myAds") },
          { href: ROUTES.accountFavorites, label: t("account.favorites") },
          ...(isAdmin
            ? [{ href: ROUTES.dashboard, label: t("dashboard.title") }]
            : []),
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-50 glass-nav border-b border-outline-variant shadow-sm transition-all">
      <div className="flex justify-between items-center w-full px-margin py-md max-w-7xl mx-auto">
        <div className="flex items-center gap-xl">
          {/* Hamburger — mobile only; opens the portaled drawer. */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="md:hidden p-2 -ms-2 text-on-surface-variant hover:text-primary transition-colors"
            aria-label={t("common.menu")}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
          >
            <Icon name="menu" />
          </button>
          <Link
            href={ROUTES.home}
            className="text-headline-md font-headline-md font-bold text-on-surface"
          >
            {t("brand.name")}
          </Link>
          <nav className="hidden md:flex items-center gap-lg">
            {navLinks.map((link) => (
              <ActiveLink
                key={link.href}
                href={link.href}
                className="pb-1 font-label-md text-label-md transition-colors"
                activeClassName="text-primary border-b-2 border-primary"
                inactiveClassName="text-on-surface-variant hover:text-primary"
              >
                {link.label}
              </ActiveLink>
            ))}
          </nav>
        </div>

        {/* Desktop-only actions. All mobile equivalents live in the drawer. */}
        <div className="hidden md:flex items-center gap-md">
          <Link
            href={ROUTES.accountAdNew}
            className="flex items-center gap-xs bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md text-label-md font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm"
          >
            <Icon name="add_circle" size={20} />
            {t("nav.postAd")}
          </Link>
          <div className="hidden lg:flex items-center gap-sm">
            <LanguageSwitcher />
            <Link
              href={isAuthenticated ? ROUTES.accountNotifications : ROUTES.login}
              className="p-2 text-on-surface-variant hover:text-primary transition-colors"
              aria-label={t("common.notifications")}
            >
              <Icon name="notifications" />
            </Link>
          </div>
          <div className="h-6 w-px bg-outline-variant mx-2 hidden lg:block" />
          {isLoading ? (
            // Session still loading. Rendering the signed-out buttons here would
            // flash "login / register" at an already-signed-in admin, then swap
            // to their real nav — the mismatch that made roles look wrong.
            <div
              aria-hidden
              className="h-10 w-40 rounded-lg bg-surface-container-low animate-pulse"
            />
          ) : isAuthenticated ? (
            <div className="flex items-center gap-sm relative">
              <RoleSwitcher />
              <AccountMenu user={user} />
            </div>
          ) : (
            <>
              <Link
                href={ROUTES.login}
                className="text-on-surface-variant hover:text-primary font-label-md text-label-md px-4 py-2 transition-all"
              >
                {t("common.login")}
              </Link>
              <Link
                href={ROUTES.register}
                className="bg-primary-container text-on-primary-container px-6 py-2.5 rounded-lg font-label-md text-label-md hover:opacity-90 active:scale-95 transition-all shadow-sm"
              >
                {t("common.listItem")}
              </Link>
            </>
          )}
        </div>
      </div>

      <MobileNav open={menuOpen} onClose={closeMenu} />
    </header>
  );
}

/** Desktop account menu with dropdown. */
function AccountMenu({
  user,
}: {
  user: ReturnType<typeof useAuth>["user"];
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const isAdmin = user?.role === "admin";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-sm p-1 rounded-lg hover:bg-surface-container-low transition-colors"
      >
        <Icon name="account_circle" className="text-primary" size={28} />
        <span className="font-label-md text-label-md text-on-surface">
          {user?.name}
        </span>
        <Icon
          name={open ? "expand_less" : "expand_more"}
          size={20}
          className="text-on-surface-variant"
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute end-0 mt-2 w-48 rounded-xl border border-outline-variant bg-surface-container-lowest p-sm shadow-xl"
        >
          <div className="flex flex-col">
            {/* Every signed-in user has a profile, admins included. The dashboard
                is a separate nav link, not a replacement for this one. */}
            <Link
              href={ROUTES.account}
              role="menuitem"
              className="flex items-center gap-md rounded-lg px-md py-sm font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-low"
              onClick={() => setOpen(false)}
            >
              <Icon name="person" size={20} />
              {t("account.profile")}
            </Link>

            {isAdmin && (
              <Link
                href={ROUTES.dashboard}
                role="menuitem"
                className="flex items-center gap-md rounded-lg px-md py-sm font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-low"
                onClick={() => setOpen(false)}
              >
                <Icon name="shield" size={20} />
                {t("dashboard.title")}
              </Link>
            )}

            {/* Divider */}
            <div className="my-xs h-px bg-outline-variant" />

            {/* Logout — always last */}
            <LogoutButton variant="link" />
          </div>
        </div>
      )}
    </div>
  );
}
