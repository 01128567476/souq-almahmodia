"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { DataTable, type Column } from "@/components/dashboard/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { Category } from "@/types";

const DEFAULT_CATEGORY = {
  nameEn: "",
  nameAr: "",
  icon: "category",
  color: "bg-primary-fixed text-primary",
};

export function CategoriesAdminView({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [formState, setFormState] = useState({ ...DEFAULT_CATEGORY });
  const [isCreating, setIsCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = useTranslations();

  const selectedCategory = useMemo(
    () => categories.find((category) => category.slug === editingSlug) || null,
    [categories, editingSlug],
  );

  const resetForm = () => {
    setEditingSlug(null);
    setFormState({ ...DEFAULT_CATEGORY });
    setIsCreating(false);
    setError(null);
  };

  const openCreateForm = () => {
    resetForm();
    setIsCreating(true);
  };

  const openEditForm = (category: Category) => {
    setEditingSlug(category.slug);
    setFormState({
      nameEn: category.nameEn ?? "",
      nameAr: category.nameAr ?? "",
      icon: category.icon,
      color: category.color,
    });
    setIsCreating(false);
  };

  const handleSave = async () => {
    setError(null);
    setBusy(true);
    try {
      const body = JSON.stringify(formState);
      let response: Response;

      if (editingSlug) {
        response = await fetch(`/api/categories/${editingSlug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body,
        });
      } else {
        response = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
      }

      if (!response.ok) throw new Error("Failed to save category.");
      const category = (await response.json()) as Category;
      setCategories((current) => {
        const existingIndex = current.findIndex((item) => item.slug === category.slug);
        if (existingIndex >= 0) {
          const next = [...current];
          next[existingIndex] = category;
          return next;
        }
        return [...current, category];
      });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleHidden = async (slug: string, hidden: boolean) => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/categories/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden }),
      });
      if (!response.ok) throw new Error("Failed to update category.");
      const category = (await response.json()) as Category;
      setCategories((current) => current.map((item) => (item.slug === slug ? category : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteCategory = async (slug: string) => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/categories/${slug}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete category.");
      setCategories((current) => current.filter((item) => item.slug !== slug));
      if (editingSlug === slug) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const moveCategory = async (slug: string, direction: "up" | "down") => {
    setError(null);
    setBusy(true);
    try {
      const index = categories.findIndex((item) => item.slug === slug);
      if (index === -1) return;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= categories.length) return;
      const reordered = [...categories];
      const [removed] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, removed);
      const slugs = reordered.map((item) => item.slug);
      const response = await fetch("/api/categories/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: slugs }),
      });
      if (!response.ok) throw new Error("Failed to reorder categories.");
      const next = (await response.json()) as Category[];
      setCategories(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Category>[] = [
    {
      key: "name",
      header: t("categoriesAdmin.name"),
      cell: (category) => (
        <div className="flex items-center gap-sm">
          <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${category.color}`}>
            <Icon name={category.icon} size={18} />
          </span>
          <div>
            <div className="font-medium text-on-surface">{category.nameEn || category.name}</div>
            <div className="text-label-sm text-on-surface-variant">{category.nameAr}</div>
          </div>
        </div>
      ),
    },
    { key: "slug", header: t("categoriesAdmin.slug"), cell: (category) => category.slug },
    { key: "count", header: t("categoriesAdmin.count"), cell: (category) => category.count },
    {
      key: "status",
      header: t("categoriesAdmin.status"),
      cell: (category) => (
        <Badge tone={category.hidden ? "neutral" : "success"}>
          {category.hidden ? t("categoriesAdmin.hidden") : t("categoriesAdmin.visible")}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      cell: (category) => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openEditForm(category)}
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-2 text-label-sm font-label-sm text-on-surface transition hover:bg-surface-container-highest"
          >
            <Icon name="edit" size={16} />
            {t("categoriesAdmin.editCategory")}
          </button>
          <button
            type="button"
            onClick={() => toggleHidden(category.slug, !category.hidden)}
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-2 text-label-sm font-label-sm text-on-surface transition hover:bg-surface-container-highest"
          >
            <Icon name={category.hidden ? "visibility" : "visibility_off"} size={16} />
            {category.hidden ? t("categoriesAdmin.unhide") : t("categoriesAdmin.hide")}
          </button>
          <button
            type="button"
            onClick={() => moveCategory(category.slug, "up")}
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-2 text-label-sm font-label-sm text-on-surface transition hover:bg-surface-container-highest"
          >
            <Icon name="arrow_upward" size={16} />
            {t("categoriesAdmin.moveUp")}
          </button>
          <button
            type="button"
            onClick={() => moveCategory(category.slug, "down")}
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-2 text-label-sm font-label-sm text-on-surface transition hover:bg-surface-container-highest"
          >
            <Icon name="arrow_downward" size={16} />
            {t("categoriesAdmin.moveDown")}
          </button>
          <button
            type="button"
            onClick={() => deleteCategory(category.slug)}
            className="inline-flex items-center gap-2 rounded-full border border-error text-error px-3 py-2 text-label-sm font-label-sm transition hover:bg-error/10"
          >
            <Icon name="delete" size={16} />
            {t("categoriesAdmin.deleteCategory")}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-xl">
      <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-headline-sm font-headline-sm text-on-surface">{t("categoriesAdmin.subtitle")}</h2>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-label-md font-label-md text-on-primary transition hover:brightness-110"
          >
            <Icon name="add" size={18} />
            {t("categoriesAdmin.createCategory")}
          </button>
        </div>
      </div>

      {error ? <div className="rounded-3xl border border-error bg-error-container/10 p-lg text-error">{error}</div> : null}

      {(isCreating || selectedCategory) && (
        <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-headline-sm font-headline-sm text-on-surface">
                {isCreating ? t("categoriesAdmin.newCategory") : t("categoriesAdmin.editCategory")}
              </h2>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="text-on-surface-variant hover:text-on-surface"
            >
              {t("common.cancel")}
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 mt-6">
            <label className="space-y-2">
              <span className="text-label-sm font-label-sm text-on-surface-variant">{t("categoriesAdmin.nameEn")}</span>
              <input
                type="text"
                value={formState.nameEn}
                onChange={(event) => setFormState((current) => ({ ...current, nameEn: event.target.value }))}
                className="w-full rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </label>
            <label className="space-y-2">
              <span className="text-label-sm font-label-sm text-on-surface-variant">{t("categoriesAdmin.nameAr")}</span>
              <input
                type="text"
                value={formState.nameAr}
                onChange={(event) => setFormState((current) => ({ ...current, nameAr: event.target.value }))}
                className="w-full rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </label>
            <label className="space-y-2">
              <span className="text-label-sm font-label-sm text-on-surface-variant">{t("categoriesAdmin.icon")}</span>
              <input
                type="text"
                value={formState.icon}
                onChange={(event) => setFormState((current) => ({ ...current, icon: event.target.value }))}
                className="w-full rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </label>
            <label className="space-y-2">
              <span className="text-label-sm font-label-sm text-on-surface-variant">{t("categoriesAdmin.color")}</span>
              <input
                type="text"
                value={formState.color}
                onChange={(event) => setFormState((current) => ({ ...current, color: event.target.value }))}
                className="w-full rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-label-md font-label-md text-on-primary transition hover:brightness-110 disabled:opacity-60"
            >
              {t("common.save")}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-6 py-3 text-label-md font-label-md text-on-surface transition hover:bg-surface-container-highest"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-lg">
        <DataTable columns={columns} rows={categories} rowKey={(category) => category.slug} />
      </div>
    </div>
  );
}
