/**
 * Category repository — Drizzle ORM implementation.
 *
 * Replaces mockDb with PostgreSQL via Drizzle ORM.
 *
 * Public interface remains EXACTLY the same.
 */

import { db } from "@/lib/db-server";
import { categories } from "@/drizzle/schema";
import { eq, asc, desc, sql } from "drizzle-orm";
import { clone } from "@/lib/db-utils";
import type { Category } from "@/types";

/* ======================================================================== */
/* Helpers                                                                  */
/* ======================================================================== */

function bySortOrder(a: Category, b: Category): number {
  return (a.order ?? 0) - (b.order ?? 0);
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `cat-${Date.now()}`;
}

/* ======================================================================== */
/* Repository                                                               */
/* ======================================================================== */

export interface CategoryInput {
  nameEn: string;
  nameAr: string;
  icon: string;
  color: string;
}

export const categoryRepository = {
  /**
   * All categories, including hidden — for the admin categories page.
   * Sorted by order ASC.
   */
  async list(): Promise<Category[]> {
    const rows = await db
      .select()
      .from(categories)
      .orderBy(asc(categories.order));

    const result: Category[] = rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      nameEn: row.nameEn ?? undefined,
      nameAr: row.nameAr ?? undefined,
      icon: row.icon,
      count: 0,
      color: "",
      order: row.order ?? undefined,
      hidden: row.hidden ?? false,
    }));

    return clone(result).sort(bySortOrder);
  },

  /**
   * Only visible categories — for the public marketplace and ad form.
   * Sorted by order ASC.
   */
  async listVisible(): Promise<Category[]> {
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.hidden, false))
      .orderBy(asc(categories.order));

    const result: Category[] = rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      nameEn: row.nameEn ?? undefined,
      nameAr: row.nameAr ?? undefined,
      icon: row.icon,
      count: 0,
      color: "",
      order: row.order ?? undefined,
      hidden: row.hidden ?? false,
    }));

    return clone(result).sort(bySortOrder);
  },

  /**
   * Get a single category by slug.
   * Returns null if not found.
   */
  async getBySlug(slug: string): Promise<Category | null> {
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    const category: Category = {
      slug: row.slug,
      name: row.name,
      nameEn: row.nameEn ?? undefined,
      nameAr: row.nameAr ?? undefined,
      icon: row.icon,
      count: 0,
      color: "",
      order: row.order ?? undefined,
      hidden: row.hidden ?? false,
    };

    return clone(category);
  },

  /**
   * Create a new category.
   * order is auto-assigned as max(current orders) + 1.
   */
  async create(input: CategoryInput): Promise<Category> {
    const slug = slugify(input.nameEn);
    const name = slug;

    const result = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${categories.order}), 0)` })
      .from(categories);
    const maxOrder = result[0]?.maxOrder ?? 0;

    const newCategory = {
      slug,
      name,
      nameEn: input.nameEn.trim(),
      nameAr: input.nameAr.trim(),
      icon: input.icon,
      color: input.color,
      order: maxOrder + 1,
      hidden: false,
    };

    await db
      .insert(categories)
      .values(newCategory)
      .onConflictDoNothing({ target: categories.slug });

    const created = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    const category: Category = {
      slug: created[0].slug,
      name: created[0].name,
      nameEn: created[0].nameEn ?? undefined,
      nameAr: created[0].nameAr ?? undefined,
      icon: created[0].icon,
      count: 0,
      color: "",
      order: created[0].order ?? undefined,
      hidden: created[0].hidden ?? false,
    };

    return clone(category);
  },

  /**
   * Update an existing category.
   */
  async update(slug: string, patch: Partial<CategoryInput>): Promise<Category> {
    const existing = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`Category not found: ${slug}`);
    }

    const updateSet: Record<string, string | undefined> = {};
    if (patch.nameEn !== undefined) updateSet.nameEn = patch.nameEn.trim();
    if (patch.nameAr !== undefined) updateSet.nameAr = patch.nameAr.trim();
    if (patch.icon !== undefined) updateSet.icon = patch.icon;
    if (patch.color !== undefined) updateSet.color = patch.color;

    await db
      .update(categories)
      .set(updateSet)
      .where(eq(categories.slug, slug));

    const updated = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    const category: Category = {
      slug: updated[0].slug,
      name: updated[0].name,
      nameEn: updated[0].nameEn ?? undefined,
      nameAr: updated[0].nameAr ?? undefined,
      icon: updated[0].icon,
      count: 0,
      color: "",
      order: updated[0].order ?? undefined,
      hidden: updated[0].hidden ?? false,
    };

    return clone(category);
  },

  /**
   * Hide or show a category.
   */
  async setHidden(slug: string, hidden: boolean): Promise<Category> {
    const existing = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`Category not found: ${slug}`);
    }

    await db
      .update(categories)
      .set({ hidden })
      .where(eq(categories.slug, slug));

    const updated = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    const category: Category = {
      slug: updated[0].slug,
      name: updated[0].name,
      nameEn: updated[0].nameEn ?? undefined,
      nameAr: updated[0].nameAr ?? undefined,
      icon: updated[0].icon,
      count: 0,
      color: "",
      order: updated[0].order ?? undefined,
      hidden: updated[0].hidden ?? false,
    };

    return clone(category);
  },

  /**
   * Remove a category by slug.
   */
  async remove(slug: string): Promise<void> {
    await db
      .delete(categories)
      .where(eq(categories.slug, slug));

    return;
  },

  /**
   * Persist a new ordering given the full list of slugs in display order.
   */
  async reorder(slugsInOrder: string[]): Promise<Category[]> {
    for (let i = 0; i < slugsInOrder.length; i++) {
      await db
        .update(categories)
        .set({ order: i + 1 })
        .where(eq(categories.slug, slugsInOrder[i]));
    }

    const rows = await db
      .select()
      .from(categories)
      .orderBy(asc(categories.order));

    const result: Category[] = rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      nameEn: row.nameEn ?? undefined,
      nameAr: row.nameAr ?? undefined,
      icon: row.icon,
      count: 0,
      color: "",
      order: row.order ?? undefined,
      hidden: row.hidden ?? false,
    }));

    return clone(result).sort(bySortOrder);
  },
};