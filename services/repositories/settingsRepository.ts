/**
 * Settings repository — Drizzle ORM implementation.
 *
 * Replaces mockDb with PostgreSQL via Drizzle ORM.
 *
 * Public interface remains EXACTLY the same.
 */

import type { MarketplaceSettings, SocialLinks } from "@/types";
import { db } from "@/lib/db-server";
import { settings } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { clone } from "@/lib/db-utils";

/* -------------------------------------------------------------------------- */
/* Input types                                                                */
/* -------------------------------------------------------------------------- */

export interface MarketplaceSettingsUpdate {
  siteName?: string;
  logoUrl?: string;
  bannerUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  socialLinks?: Partial<SocialLinks>;
  approvalMode?: MarketplaceSettings["approvalMode"];
  allowEditBeforeApproval?: boolean;
  defaultCurrency?: string;
  defaultAdDurationDays?: number;
}

/**
 * Map a Drizzle settings row into the MarketplaceSettings view model.
 * The settings table uses a single-row key-value pattern (key = "marketplace").
 * Social links are stored as a JSON string in the socialLinks column.
 */
function mapToSettings(row: typeof settings.$inferSelect): MarketplaceSettings {
  let socialLinks: SocialLinks = {
    facebook: "",
    instagram: "",
    twitter: "",
    whatsapp: "",
  };

  if (row.socialLinks) {
    try {
      const parsed = JSON.parse(row.socialLinks);
      socialLinks = {
        facebook: parsed.facebook ?? "",
        instagram: parsed.instagram ?? "",
        twitter: parsed.twitter ?? "",
        whatsapp: parsed.whatsapp ?? "",
      };
    } catch {
      // Invalid JSON — use defaults
    }
  }

  return {
    siteName: row.siteName ?? "سوق المحمودية",
    logoUrl: row.logoUrl ?? "",
    bannerUrl: row.bannerUrl ?? "",
    contactEmail: row.contactEmail ?? "",
    contactPhone: row.contactPhone ?? "",
    contactAddress: row.contactAddress ?? "",
    socialLinks,
    approvalMode: (row.approvalMode ?? "manual") as MarketplaceSettings["approvalMode"],
    allowEditBeforeApproval: row.allowEditBeforeApproval ?? true,
    defaultCurrency: row.defaultCurrency ?? "SAR",
    defaultAdDurationDays: row.defaultAdDurationDays ?? 30,
  };
}

/* -------------------------------------------------------------------------- */
/* Repository                                                                 */
/* -------------------------------------------------------------------------- */

export const settingsRepository = {
  /**
   * Get marketplace settings.
   * Uses single-row key-value pattern — only one row exists.
   */
  async get(): Promise<MarketplaceSettings> {
    const rows = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "marketplace"));

    if (rows.length === 0) {
      // Fallback to default settings if no row exists yet
      return {
        siteName: "سوق المحمودية",
        logoUrl: "",
        bannerUrl: "",
        contactEmail: "",
        contactPhone: "",
        contactAddress: "",
        socialLinks: { facebook: "", instagram: "", twitter: "", whatsapp: "" },
        approvalMode: "manual" as const,
        allowEditBeforeApproval: true,
        defaultCurrency: "SAR",
        defaultAdDurationDays: 30,
      };
    }

    return clone(mapToSettings(rows[0]));
  },

  /**
   * Update marketplace settings.
   * Upserts the single row (key = "marketplace").
   */
  async update(patch: MarketplaceSettingsUpdate): Promise<MarketplaceSettings> {
    const socialLinks = patch.socialLinks ?? {};

    await db
      .insert(settings)
      .values({
        key: "marketplace",
        siteName: patch.siteName,
        logoUrl: patch.logoUrl,
        bannerUrl: patch.bannerUrl,
        contactEmail: patch.contactEmail,
        contactPhone: patch.contactPhone,
        contactAddress: patch.contactAddress,
        socialLinks: JSON.stringify(socialLinks),
        approvalMode: patch.approvalMode,
        allowEditBeforeApproval: patch.allowEditBeforeApproval,
        defaultCurrency: patch.defaultCurrency,
        defaultAdDurationDays: patch.defaultAdDurationDays,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          siteName: patch.siteName,
          logoUrl: patch.logoUrl,
          bannerUrl: patch.bannerUrl,
          contactEmail: patch.contactEmail,
          contactPhone: patch.contactPhone,
          contactAddress: patch.contactAddress,
          socialLinks: JSON.stringify(socialLinks),
          approvalMode: patch.approvalMode,
          allowEditBeforeApproval: patch.allowEditBeforeApproval,
          defaultCurrency: patch.defaultCurrency,
          defaultAdDurationDays: patch.defaultAdDurationDays,
        },
      });

    const rows = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "marketplace"));

    return clone(mapToSettings(rows[0]));
  },
};