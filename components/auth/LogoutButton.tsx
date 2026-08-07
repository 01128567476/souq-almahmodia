"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/utils/cn";

/**
 * LogoutButton renders a "Log out" link in dropdown menus.
 *
 * On click a confirmation dialog appears.  On confirm the existing
 * AuthContext.logout() is called (which clears cookies, localStorage
 * and sessionStorage) and the user is redirected to the home page.
 */
export function LogoutButton({
  className,
  variant = "link",
}: {
  className?: string;
  variant?: "link" | "block";
}) {
  const t = useTranslations("common");
  const router = useRouter();
  const { logout } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setDialogOpen(false);
    router.push(ROUTES.home);
    // Server components (dashboard/account gates) cache their RSC payload on
    // the client. Without refresh() the stale authenticated tree can be
    // re-served from the Router Cache after the cookie is already gone.
    router.refresh();
  };

  const baseClass =
    "flex items-center gap-md transition-colors cursor-pointer";

  const variantClass = cn(
    baseClass,
    variant === "block"
      ? "w-full rounded-lg border border-outline-variant px-4 py-2.5 text-center font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low"
      : "w-full items-center gap-md px-md py-sm font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low",
  );

  return (
    <>
      {/* Trigger */}
       <button
         type="button"
         onClick={() => setDialogOpen(true)}
         className={variantClass}
         aria-label={t("logout")}
       >
         <Icon name="logout" size={20} className="text-error" />
         <span>{t("logout")}</span>
       </button>

      {/* Confirmation Dialog Overlay */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          role="dialog"
          aria-modal
          aria-labelledby="logout-dialog-title"
        >
          {/* Scrim */}
          <div
            className="absolute inset-0 bg-scrim/50"
            onClick={() => setDialogOpen(false)}
          />
          {/* Dialog card */}
          <div className="relative z-10 w-full max-w-sm mx-4 rounded-2xl bg-surface-container-lowest p-lg shadow-2xl">
            <div className="flex flex-col items-center gap-md text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-error/10">
                <Icon name="logout" size={28} className="text-error" />
              </div>
              <h2
                id="logout-dialog-title"
                className="text-headline-sm text-on-surface"
              >
                {t("logoutTitle")}
              </h2>
              <p className="text-body-sm text-on-surface-variant">
                {t("logoutMessage")}
              </p>
              <div className="flex w-full gap-sm mt-md">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="flex-1 rounded-lg border border-outline-variant px-4 py-2.5 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex-1 rounded-lg bg-error px-4 py-2.5 font-label-md text-label-md font-bold text-on-error transition-colors hover:brightness-110"
                >
                  {t("logoutConfirm")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}