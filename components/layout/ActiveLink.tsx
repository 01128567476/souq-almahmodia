"use client";

import type { ComponentProps, ReactNode } from "react";
import { Link } from "@/i18n/routing";
import { useActiveRoute } from "@/hooks/useActiveRoute";
import { cn } from "@/utils/cn";

interface ActiveLinkProps extends Omit<ComponentProps<typeof Link>, "href"> {
  href: string;
  activeClassName: string;
  inactiveClassName?: string;
  exact?: boolean;
  children: ReactNode;
}

/** Link that applies `activeClassName` when it matches the current route. */
export function ActiveLink({
  href,
  activeClassName,
  inactiveClassName = "",
  exact = false,
  className,
  children,
  ...props
}: ActiveLinkProps) {
  const { isActive } = useActiveRoute();
  const active = isActive(href, exact);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(className, active ? activeClassName : inactiveClassName)}
      {...props}
    >
      {children}
    </Link>
  );
}
