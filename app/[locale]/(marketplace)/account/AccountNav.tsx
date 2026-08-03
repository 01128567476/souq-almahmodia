"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/utils/cn";

const items = [
  { href: ROUTES.accountProfile, key: "profile", icon: "person" },
] as const;

export function AccountNav() {
  const t = useTranslations("account");
  const pathname = usePathname();

  return (
    <nav className="flex flex-row md:flex-col gap-xs overflow-x-auto custom-scrollbar">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-sm px-md py-sm rounded-xl font-label-md text-label-md whitespace-nowrap transition-colors",
              active
                ? "bg-primary-fixed text-primary"
                : "text-on-surface-variant hover:bg-surface-container-low",
            )}
          >
            <Icon name={item.icon} size={20} />
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
