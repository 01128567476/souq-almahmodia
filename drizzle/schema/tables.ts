/**
 * Drizzle table definitions — complete PostgreSQL schema for SouqNa.
 *
 * Every table maps directly to a type in types/index.ts.
 * No invented fields. No missing fields. Exact consistency.
 *
 * Improvements over initial version:
 * - All primary keys use UUID (defaultRandom())
 * - Images normalized into ad_images table
 * - All required indexes added
 */

import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  uniqueIndex,
  index,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";

import {
  adStatusEnum,
  roleEnum,
  productConditionEnum,
  reportSeverityEnum,
  reportStatusEnum,
  reportReasonEnum,
  moderationActionEnum,
  reactionTypeEnum,
  auditTargetTypeEnum,
  notificationTypeEnum,
  commentStatusEnum,
  approvalModeEnum,
} from "./enums";

/* ======================================================================== */
/* 1. USERS                                                                 */
/* ======================================================================== */
/** Mirrors types/index.ts User interface. All IDs are UUID. */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** Real display name shown publicly on ads and comments. */
  displayName: text("display_name").notNull(),

  /** Public unique username (lowercase). Used for profile URL: /u/[username]. */
  username: varchar("username", { length: 50 }).unique().notNull(),

  /** Lowercase username for case-insensitive lookups. */
  usernameLower: varchar("username_lower", { length: 50 }).unique().notNull(),

  /** When the username was last changed (cooldown tracking). */
  usernameLastChangedAt: timestamp("username_last_changed_at"),

  /** ISO join date. */
  joinedAt: timestamp("joined_at").defaultNow().notNull(),

  /** Avatar URL. */
  avatar: text("avatar").default(""),

  /** Google ID (external auth provider). */
  googleId: text("google_id").unique(),

  /** Email (never shown publicly). */
  email: text("email").unique().notNull(),

  /** Email verified flag set by OAuth providers. */
  emailVerified: timestamp("email_verified", { mode: "string" }),

  /** Optional bio. */
  bio: text("bio"),

  /** Internal role (never exposed publicly). */
  role: roleEnum("role").default("user").notNull(),

  /** Phone (private, never shown on profile). */
  phone: text("phone"),

  /** Password hash (pbkdf2-sha512 hex). Used for email/password auth. */
  passwordHash: text("password_hash"),

  /** Password salt (hex). Paired with passwordHash. */
  passwordSalt: text("password_salt"),

  /** Whether the user has set a password (null means OAuth-only, no password). */
  hasPassword: boolean("has_password").default(false),

  /** When the user last changed their password. Used for JWT session invalidation. */
  passwordChangedAt: timestamp("password_changed_at"),

  /** Timestamps. */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ======================================================================== */
/* 2. CATEGORIES                                                            */
/* ======================================================================== */
/** Mirrors types/index.ts Category interface. Slug is PK. */

export const categories = pgTable("categories", {
  slug: varchar("slug", { length: 100 }).primaryKey().notNull(),

  /** Legacy i18n key used by the public marketplace. */
  name: text("name").notNull(),

  /** Bilingual display names for admin-managed categories. */
  nameEn: text("name_en"),
  nameAr: text("name_ar"),

  /** Icon name (Material Icons or similar). */
  icon: text("icon").notNull(),

  /** Display order in listings (lower sorts first). */
  order: integer("order").default(0),

  /** Hidden categories are kept but not offered publicly. */
  hidden: boolean("hidden").default(false),

  /** Timestamps. */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ======================================================================== */
/* 3. PRODUCTS (ADS)                                                        */
/* ======================================================================== */
/** Mirrors types/index.ts Product interface.
 *
 * ID changed from varchar to UUID.
 * Image fields removed — now stored in ad_images table.
 */

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** Title. */
  title: text("title").notNull(),

  /** FK → categories.slug. */
  categorySlug: varchar("category_slug", { length: 100 }).notNull(),

  /** Optional description. */
  description: text("description"),

  /** Price (decimal for precision). */
  price: numeric("price", { precision: 12, scale: 2 }),

  /** Currency code (e.g., "SAR"). */
  currency: text("currency").default("SAR"),

  /** Condition: new | excellent | good | fair. */
  condition: productConditionEnum("condition").notNull(),

  /** Location. */
  location: text("location").notNull(),

  /** Display name shown publicly. */
  sellerName: text("seller_name").notNull(),

  /** Seller phone (private). */
  sellerPhone: text("seller_phone").notNull(),

  /** Status: pending | approved | rejected | hidden | expired | sold | deleted. */
  status: adStatusEnum("status").default("pending").notNull(),

  /** FK → users.id. */
  ownerId: uuid("owner_id").notNull(),

  /** Admin feature flag. */
  featured: boolean("featured").default(false),

  /** Pin flag (pinned ads appear first). */
  pinned: boolean("pinned").default(false),

  /** Timestamp when last pinned (for sorting). */
  pinnedAt: timestamp("pinned_at"),

  /** Timestamps. */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  /** Expiration date. */
  expiresAt: timestamp("expires_at"),

  /** Rejection reason (set by admin when rejected). */
  rejectionReason: text("rejection_reason"),

  /** Admin notes. */
  adminNotes: text("admin_notes"),
}, (t) => ({
  /** Index: fetch by owner (My Ads). */
  idxProductsOwnerId: index("idx_products_owner_id").on(t.ownerId),

  /** Index: admin filtering + marketplace feed. */
  idxProductsStatus: index("idx_products_status").on(t.status),

  /** Index: category marketplace feed. */
  idxProductsCategoryStatus: index("idx_products_category_status").on(
    t.categorySlug,
    t.status
  ),

  /** Index: pinned ads sorting (pinned first, then by pinnedAt DESC). */
  idxProductsPinned: index("idx_products_pinned").on(t.pinned, t.pinnedAt, t.createdAt),

  /** Index: expiry cleanup job. */
  idxProductsExpiresAt: index("idx_products_expires_at").on(t.expiresAt),
}));

/* ======================================================================== */
/* 4. AD IMAGES (NEW — normalized from products.image/images)               */
/* ======================================================================== */

/**
 * Single source of truth for ad images.
 *
 * Previous architecture duplicated images in products.image + products.images[].
 * Now every image is a row with order, isPrimary flag, and timestamps.
 *
 * The first image with isPrimary=true serves as the "main image".
 * UI falls back to the first image if no primary is set.
 */

export const adImages = pgTable("ad_images", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** FK → products.id. */
  adId: uuid("ad_id").notNull(),

  /** Full URL to the image (Cloudflare R2 or external). */
  imageUrl: text("image_url").notNull(),

  /** Sort order (0 = primary/main image). */
  sortOrder: integer("sort_order").default(0).notNull(),

  /** Whether this image is the primary display image. */
  isPrimary: boolean("is_primary").default(false).notNull(),

  /** Timestamp. */
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  /** Index: fetch all images for an ad. */
  idxAdImagesAdId: index("idx_ad_images_ad_id").on(t.adId),

  /**
   * Unique: at most ONE primary image per ad.
   *
   * Must be a PARTIAL index (WHERE is_primary). A plain unique index on
   * (ad_id, is_primary) also uniques the (ad_id, false) pair, which caps every
   * ad at 2 images total — one primary, one non-primary.
   */
  uniqueAdPrimary: uniqueIndex("unique_ad_primary_image")
    .on(t.adId)
    .where(sql`${t.isPrimary}`),
}));

/* ======================================================================== */
/* 5. COMMENTS                                                              */
/* ======================================================================== */
/** Mirrors types/index.ts StoredComment interface.
 *
 * ID changed from varchar to UUID.
 * Supports unlimited nesting via parentId self-reference.
 */

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** FK → products.id. */
  adId: uuid("ad_id").notNull(),

  /** FK → comments.id (self-reference for replies). Null for top-level. */
  parentId: uuid("parent_id"),

  /** FK → users.id (null if user is deleted/guest). */
  authorId: uuid("author_id").notNull(),

  /** Author display name (stored for guest comments and historical accuracy). */
  authorName: text("author_name").notNull(),

  /** Author avatar URL (stored for historical accuracy). */
  authorAvatar: text("author_avatar").default(""),

  /** Comment text content. */
  content: text("content").notNull(),

  /** Timestamps. */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  /** When edited (nullable). */
  editedAt: timestamp("edited_at"),

  /** Visibility status. */
  status: commentStatusEnum("status").default("visible").notNull(),
}, (t) => ({
  /** Index: fetch all comments for an ad. */
  idxCommentsAdId: index("idx_comments_ad_id").on(t.adId),

  /** Index: fetch replies to a comment. */
  idxCommentsParentId: index("idx_comments_parent_id").on(t.parentId),

  /** Index: fetch all comments by an author. */
  idxCommentsAuthorId: index("idx_comments_author_id").on(t.authorId),
}));

/* ======================================================================== */
/* 6. REACTIONS                                                             */
/* ======================================================================== */
/** Mirrors types/index.ts ReactionRow interface.
 *
 * ID changed from uuid with defaultRandom() to explicit UUID.
 * Unique constraint: one reaction per user per ad.
 */

export const reactions = pgTable("reactions", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** FK → products.id. */
  adId: uuid("ad_id").notNull(),

  /** FK → users.id. */
  userId: uuid("user_id").notNull(),

  /** Type of reaction. */
  type: reactionTypeEnum("type").notNull(),

  /** Timestamp. */
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  /** Unique: one reaction per user per ad. */
  uniqueReaction: uniqueIndex("unique_reaction").on(t.adId, t.userId),

  /** Index: fetch all reactions on an ad. */
  idxReactionsAdId: index("idx_reactions_ad_id").on(t.adId),

  /** Index: fetch all reactions by a user. */
  idxReactionsUserId: index("idx_reactions_user_id").on(t.userId),
}));

/* ======================================================================== */
/* 7. FAVORITES                                                             */
/* ======================================================================== */
/** Mirrors types/index.ts FavoriteRow interface.
 *
 * ID is UUID. Unique constraint: one favorite per user per ad.
 */

export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** FK → users.id. */
    userId: uuid("user_id").notNull(),

    /** FK → products.id. */
    adId: uuid("ad_id").notNull(),

    /** Timestamp. */
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    /** Unique: one favorite per user per ad. */
    uniqueFavorite: uniqueIndex("unique_favorite").on(t.userId, t.adId),

    /** Index: fetch all favorites by a user. */
    idxFavoritesUserId: index("idx_favorites_user_id").on(t.userId),

    /** Index: fetch all favorites of an ad. */
    idxFavoritesAdId: index("idx_favorites_ad_id").on(t.adId),
  })
);

/* ======================================================================== */
/* 8. REPORTS                                                               */
/* ======================================================================== */
/** Mirrors types/index.ts AdReport interface.
 *
 * ID changed from varchar to UUID.
 */

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** FK → products.id. */
  adId: uuid("ad_id").notNull(),

  /** FK → users.id. */
  reporterId: uuid("reporter_id").notNull(),

  /** Reporter name (stored for historical accuracy). */
  reporterName: text("reporter_name").notNull(),

  /** Reason category. */
  reason: reportReasonEnum("reason").notNull(),

  /** Additional description. */
  description: text("description"),

  /** Severity level. */
  severity: reportSeverityEnum("severity").notNull(),

  /** Status: open | investigating | resolved. */
  status: reportStatusEnum("status").default("open").notNull(),

  /** Timestamp. */
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  /** Index: fetch all reports on an ad. */
  idxReportsAdId: index("idx_reports_ad_id").on(t.adId),

  /** Index: admin queue of unresolved reports. */
  idxReportsStatus: index("idx_reports_status").on(t.status),

  /** Index: reports by a reporter. */
  idxReportsReporterId: index("idx_reports_reporter_id").on(t.reporterId),
}));

/* ======================================================================== */
/* 9. MODERATION EVENTS                                                     */
/* ======================================================================== */
/** Mirrors types/index.ts ModerationEvent interface.
 *
 * ID changed from varchar to UUID.
 */

export const moderationEvents = pgTable("moderation_events", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** FK → products.id. */
  adId: uuid("ad_id").notNull(),

  /** Action taken. */
  action: moderationActionEnum("action").notNull(),

  /** FK → users.id (the admin who took the action). */
  actorId: uuid("actor_id").notNull(),

  /** Actor name (stored for historical accuracy). */
  actorName: text("actor_name").notNull(),

  /** Optional note. */
  note: text("note"),

  /** Timestamp. */
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  /** Index: all moderation events on an ad. */
  idxModerationAdId: index("idx_moderation_ad_id").on(t.adId),

  /** Index: events by an admin. */
  idxModerationActorId: index("idx_moderation_actor_id").on(t.actorId),
}));

/* ======================================================================== */
/* 10. AUDIT LOGS                                                           */
/* ======================================================================== */
/** Mirrors types/index.ts AuditLogEntry interface.
 *
 * ID changed from varchar to UUID.
 */

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** Action taken. */
  action: moderationActionEnum("action").notNull(),

  /** FK → users.id. */
  actorId: uuid("actor_id").notNull(),

  /** Actor name (stored for historical accuracy). */
  actorName: text("actor_name").notNull(),

  /** Target type (ad | user | report | category | system). */
  targetType: auditTargetTypeEnum("target_type").notNull(),

  /** Target ID. */
  targetId: uuid("target_id").notNull(),

  /** Target label (human-readable). */
  targetLabel: text("target_label"),

  /** Optional note. */
  note: text("note"),

  /** Timestamp. */
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  /** Index: audit logs by actor. */
  idxAuditActorId: index("idx_audit_actor_id").on(t.actorId),

  /** Index: audit logs by target. */
  idxAuditTarget: index("idx_audit_target").on(t.targetType, t.targetId),

  /** Index: audit logs by action type. */
  idxAuditAction: index("idx_audit_action").on(t.action),
}));

/* ======================================================================== */                                                       
/* 11. NOTIFICATIONS */
/* ======================================================================== */
/** Mirrors types/index.ts AppNotification interface.
 *
 * ID changed from varchar to UUID.
 */

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** Notification type. */
  type: notificationTypeEnum("type").notNull(),

  /** Title. */
  title: text("title").notNull(),

  /** Body. */
  body: text("body").notNull(),

  /** Relative time string (display-only, e.g., "منذ 5 دقائق"). */
  time: text("time"),

  /** Whether read. */
  read: boolean("read").default(false).notNull(),

  /** FK → users.id (recipient). Null for admin/system notifications. */
  recipientId: uuid("recipient_id").notNull(),

  /** FK → products.id (related ad). Null for system notifications. */
  adId: uuid("ad_id"),

  /** Timestamp. */
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  /** Index: fetch all notifications for a user. */
  idxNotificationsRecipient: index("idx_notifications_recipient").on(t.recipientId),

  /** Index: unread notifications for a user. */
  idxNotificationsUnread: index("idx_notifications_unread").on(
    t.recipientId,
    t.read
  ),

  /** Index: notifications related to an ad. */
  idxNotificationsAdId: index("idx_notifications_ad_id").on(t.adId),
}));

/* ======================================================================== */
/* 12. SETTINGS                                                             */
/* ======================================================================== */
/** Mirrors types/index.ts MarketplaceSettings interface.
 *
 * Uses single-row key-value pattern.
 * key defaults to "marketplace" — only one row exists.
 */

export const settings = pgTable("settings", {
  /** Unique key (always 'marketplace' for the single settings row). */
  key: varchar("key", { length: 50 }).primaryKey().default("marketplace"),

  /** Site name. */
  siteName: text("site_name").default("سوق المحمودية"),

  /** Logo URL. */
  logoUrl: text("logo_url"),

  /** Banner URL. */
  bannerUrl: text("banner_url"),

  /** Contact email. */
  contactEmail: text("contact_email"),

  /** Contact phone. */
  contactPhone: text("contact_phone"),

  /** Contact address. */
  contactAddress: text("contact_address"),

  /** Social links (JSON string). */
  socialLinks: text("social_links"),

  /** Approval mode: manual | automatic. */
  approvalMode: approvalModeEnum("approval_mode").default("manual"),

  /** Allow edit before approval. */
  allowEditBeforeApproval: boolean("allow_edit_before_approval").default(true),

  /** Default currency. */
  defaultCurrency: text("default_currency").default("SAR"),

  /** Default ad duration in days. */
  defaultAdDurationDays: integer("default_ad_duration_days").default(30),

  /** Timestamps. */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ======================================================================== */
/* 13. PINS                                                                 */
/* ======================================================================== */
/** Tracks manual pins set by admins. */

export const pins = pgTable("pins", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** FK → products.id. */
  adId: uuid("ad_id").notNull(),

  /** FK → users.id (admin who pinned). */
  ownerId: uuid("owner_id").notNull(),

  /** Whether the pin is active. */
  isPinned: boolean("is_pinned").default(true).notNull(),

  /** When the pin expires. */
  expiryDate: timestamp("expiry_date"),

  /** Timestamp. */
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  /** Index: fetch all pins for an ad. */
  idxPinsAdId: index("idx_pins_ad_id").on(t.adId),

  /** Index: fetch all pins by an admin. */
  idxPinsOwnerId: index("idx_pins_owner_id").on(t.ownerId),

  /** Index: fetch pins by expiry date. */
  idxPinsExpiryDate: index("idx_pins_expiry_date").on(t.expiryDate),
}));

/* ======================================================================== */                                                       
/* 14. USER SETTINGS */
/* ======================================================================== */
/** Per-user preferences. One row per user. */

export const userSettings = pgTable("user_settings", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** FK → users.id. */
  userId: uuid("user_id").notNull(),

  /** Theme: light | dark | system. */
  theme: text("theme").default("light"),

  /** Language code: ar | en. */
  language: text("language").default("ar"),

  /** Timestamp. */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  /** Unique: one settings row per user. */
  uniqueSettingsUser: uniqueIndex("unique_settings_user_id").on(t.userId),
}));

/* ======================================================================== */
/* 15. USERNAME HISTORY                                                     */
/* ======================================================================== */
/** Tracks all username changes for audit. */

export const usernameHistory = pgTable("username_history", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** FK → users.id. */
  userId: uuid("user_id").notNull(),

  /** The username that was set. */
  username: varchar("username", { length: 50 }).notNull(),

  /** When the username change was recorded. */
  changedAt: timestamp("changed_at").defaultNow().notNull(),

  /** When this username entry expires (for cleanup). */
  expiresAt: timestamp("expires_at"),
});

/* ======================================================================== */
/* Re-export all tables for imports in schema/index.ts                      */
/* ======================================================================== */

export const tables = {
  users,
  categories,
  products,
  adImages,
  comments,
  reactions,
  favorites,
  reports,
  moderationEvents,
  auditLogs,
  notifications,
  settings,
  pins,
  userSettings,
  usernameHistory,
};

export type AllTables = typeof tables;
