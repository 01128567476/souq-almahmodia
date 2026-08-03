"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { DataTable, type Column } from "@/components/dashboard/DataTable";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/utils/format";
import type { Locale } from "@/i18n/routing";
import type { DirectoryUser } from "@/types";

export function UsersTable({ users }: { users: DirectoryUser[] }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;

  const columns: Column<DirectoryUser>[] = [
    {
      key: "name",
      header: t("users.name"),
      cell: (u) => (
        <div className="flex items-center gap-sm">
          <Image
            src={u.avatar}
            alt=""
            width={32}
            height={32}
            className="rounded-full object-cover"
          />
          <span className="font-medium text-on-surface">{u.name}</span>
        </div>
      ),
    },
    { key: "email", header: t("users.email"), cell: (u) => u.email },
    { key: "role", header: t("users.roleCol"), cell: (u) => t(`roles.${u.role}`) },
    {
      key: "status",
      header: t("users.statusCol"),
      cell: (u) => (
        <Badge tone={u.status === "active" ? "success" : "error"}>
          {t(`users.${u.status}`)}
        </Badge>
      ),
    },
    { key: "joined", header: t("users.joined"), cell: (u) => formatDate(u.joinedDate, locale) },
    { key: "adsCount", header: t("users.adsCount"), cell: (u) => u.adsCount },
    {
      key: "actions",
      header: t("common.actions"),
      cell: (u) => (
        <Link href={ROUTES.user(u.id)} className="text-primary font-label-md hover:underline">
          {t("users.viewProfile")}
        </Link>
      ),
    },
  ];

  return <DataTable columns={columns} rows={users} rowKey={(u) => u.id} />;
}
