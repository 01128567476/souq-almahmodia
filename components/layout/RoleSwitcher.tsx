"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "@/components/ui/Icon";

/**
 * Displays the signed-in user's role.
 *
 * This was previously a demo-only switcher that flipped roles client-side. Now
 * that AuthContext is backed by real credential auth, a role can only change
 * server-side, so this renders the session's role read-only.
 */
export function RoleSwitcher() {
  const t = useTranslations("roles");
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="flex items-center gap-md w-full rounded-lg border border-outline-variant px-4 py-2.5 font-label-md text-label-md text-on-surface-variant">
      <Icon name="badge" size={20} />
      <span className="flex-1 text-start">{t(user.role)}</span>
    </div>
  );
}
