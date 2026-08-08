"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { DataTable, type Column } from "@/components/dashboard/DataTable";
import { Badge } from "@/components/ui/Badge";
import { SafeAvatar } from "@/components/ui/SafeImage";
import { formatDate } from "@/utils/format";
import type { DirectoryUser } from "@/types";
import type { Locale } from "@/i18n/routing";

interface UserSummary extends DirectoryUser {
  reportsCount: number;
}

export function UsersView({ initialUsers }: { initialUsers: UserSummary[] }) {
  const [users, setUsers] = useState<UserSummary[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = useTranslations();
  const locale = useLocale() as Locale;

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return users.filter((user) => {
      if (statusFilter !== "all" && user.status !== statusFilter) return false;
      if (!normalizedSearch) return true;
      return [user.name, user.email, user.phone ?? ""].some((value) =>
        value.toLowerCase().includes(normalizedSearch),
      );
    });
  }, [search, statusFilter, users]);

  const updateUser = (updated: UserSummary) => {
    setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
  };

  const removeUser = (userId: string) => {
    setUsers((current) => current.filter((user) => user.id !== userId));
  };

  const handleToggleStatus = async (userId: string, nextStatus: "active" | "suspended") => {
    setError(null);
    setBusyUserId(userId);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error("Failed to update user status.");
      const updated = (await response.json()) as UserSummary;
      updateUser({ ...updated, reportsCount: users.find((u) => u.id === userId)?.reportsCount ?? 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyUserId(null);
    }
  };

  const handleDelete = async (userId: string) => {
    setError(null);
    setBusyUserId(userId);
    try {
      const response = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete user.");
      removeUser(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyUserId(null);
    }
  };

  const columns: Column<UserSummary>[] = [
    {
      key: "name",
      header: t("users.name"),
      cell: (user) => (
        <div className="flex items-center gap-sm">
          <SafeAvatar src={user.avatar} name={user.name} width={36} height={36} />
          <div>
            <div className="font-medium text-on-surface">{user.name}</div>
            <div className="text-label-sm text-on-surface-variant">{user.email}</div>
          </div>
        </div>
      ),
    },
    { key: "phone", header: t("users.phone"), cell: (user) => user.phone ?? "—" },
    { key: "joined", header: t("users.registrationDate"), cell: (user) => formatDate(user.joinedDate, locale) },
    { key: "adsCount", header: t("users.adsCount"), cell: (user) => user.adsCount },
    { key: "reportsCount", header: t("users.reportsCount"), cell: (user) => user.reportsCount },
    {
      key: "status",
      header: t("users.statusCol"),
      cell: (user) => (
        <Badge tone={user.status === "active" ? "success" : "error"}>{t(`users.${user.status}`)}</Badge>
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      cell: (user) => (
        <div className="flex flex-wrap gap-2">
          <Link href={ROUTES.user(user.id)} className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-2 text-label-sm font-label-sm text-on-surface transition hover:bg-surface-container-highest">
            {t("users.viewProfile")}
          </Link>
          <button
            type="button"
            disabled={busyUserId === user.id}
            onClick={() => handleToggleStatus(user.id, user.status === "active" ? "suspended" : "active")}
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-2 text-label-sm font-label-sm text-on-surface transition hover:bg-surface-container-highest disabled:opacity-60"
          >
            {user.status === "active" ? t("users.suspend") : t("users.activate")}
          </button>
          <button
            type="button"
            disabled={busyUserId === user.id}
            onClick={() => handleDelete(user.id)}
            className="inline-flex items-center gap-2 rounded-full border border-error text-error px-3 py-2 text-label-sm font-label-sm transition hover:bg-error/10 disabled:opacity-60"
          >
            {t("users.delete")}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-xl">
      <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-lg">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
          <div className="space-y-3">
            <label className="text-label-sm font-label-sm text-on-surface-variant">{t("common.search")}</label>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("dashboard.searchPlaceholder")}
              className="w-full rounded-2xl border border-outline-variant bg-surface-container p-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-label-sm font-label-sm text-on-surface-variant">{t("users.statusCol")}</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "suspended")}
                className="w-full rounded-2xl border border-outline-variant bg-surface-container px-3 py-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              >
                <option value="all">{t("common.all")}</option>
                <option value="active">{t("users.active")}</option>
                <option value="suspended">{t("users.suspended")}</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
              className="rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-label-md font-label-md text-on-surface transition hover:bg-surface-container-highest"
            >
              {t("common.reset")}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-3xl border border-error bg-error-container/10 p-lg text-error">{error}</div>
      ) : null}

      <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-lg">
        <DataTable columns={columns} rows={filteredUsers} rowKey={(user) => user.id} />
      </div>
    </div>
  );
}
