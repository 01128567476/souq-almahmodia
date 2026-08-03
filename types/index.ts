export type Role = "guest" | "user" | "admin";

export type AdStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "hidden"
  | "expired"
  | "sold"
  | "deleted";

/** Statuses whose ads are shown on the public marketplace. */
export const PUBLIC_AD_STATUSES: AdStatus[] = ["approved"];

/* ======================================================================== */
/* User Identity Types — separated into ID, Username, Display Name          */
/* ======================================================================== */

/**
 * A permanent, opaque user identifier (UUID/ObjectId).
 * All relationships (ads, comments, favorites, etc.) reference this ID.
 * Never changes. Never used as a public URL segment.
 */
export type UserId = string;

/**
 * A human-readable public identifier. Used ONLY for:
 *  - Profile URL: /u/[username]
 *  - Search display
 *  - Discovery
 *
 * May be changed by the user (subject to rules).
 * Changing does NOT affect any data relationships.
 */
export type Username = string;

/**
 * The user's real display name shown on ads, comments, and profile.
 * May contain any characters (Arabic, spaces, etc.).
 */
export type DisplayName = string;

/**
 * Full User model compatible with future PostgreSQL + Prisma / MongoDB.
 */
export interface User {
  /** Permanent internal ID — never changes, never public. */
  id: UserId;

  /** Real display name — may contain Arabic, spaces, etc. */
  displayName: DisplayName;

  /** Public unique username (stored lowercase, used for profile URL). */
  username: Username;

  /** Lowercase username for case-insensitive lookups. */
  usernameLower: string;

  /** When the username was last changed (cooldown tracking). */
  usernameLastChangedAt: string | null;

  /** ISO join date. */
  joinedAt: string;

  /** Avatar URL. */
  avatar: string;

  /** Google ID (external auth provider). */
  googleId: string;

  /** Email (never shown publicly). */
  email: string;

  /** Optional bio (reserved for future). */
  bio?: string;

  /** Internal role (never exposed publicly). */
  role: Role;

  /** Deprecated alias for displayName — keep for backward compat with ads. */
  name?: string;

  /** Phone (private, never shown on profile). */
  phone?: string;
}

/* ======================================================================== */
/* Legacy User type (backward compatibility — maps to above)                */
/* ======================================================================== */

/**
 * Legacy user type used by the mock AuthContext.
 * For new code, use the User interface above with username fields.
 */
export interface LegacyUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  avatar: string;
  title?: string;
}

/* ======================================================================== */
/* Advertisement Types                                                      */
/* ======================================================================== */

export type ProductCondition = "new" | "excellent" | "good" | "fair";

export interface Product {
  id: string;
  title: string;
  categorySlug: string;
  price: number;
  currency: string;
  condition: ProductCondition;
  location: string;
  /** Display Name — shown publicly on ads and in search. */
  sellerName: string;
  sellerPhone: string;
  postedAgoHours: number;
  image: string;
  images?: string[];
  description?: string;
  status: AdStatus;
  /** References User.id (permanent, never changes). */
  ownerId?: string;
  featured?: boolean;
  pinned?: boolean;
  /** ISO timestamp when the ad was last pinned. Used for sorting pinned ads (most recent first). */
  pinnedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
  rejectionReason?: string;
  adminNotes?: string;
}

/* ======================================================================== */
/* Category Types                                                           */
/* ======================================================================== */

export interface Category {
  slug: string;
  /** Legacy i18n key used by the public marketplace. */
  name: string;
  /** Bilingual display names for admin-managed categories. */
  nameEn?: string;
  nameAr?: string;
  icon: string;
  count: number;
  color: string;
  /** Display order in listings (lower sorts first). */
  order?: number;
  /** Hidden categories are kept but not offered publicly. */
  hidden?: boolean;
}

/* ======================================================================== */
/* Social & Settings Types                                                  */
/* ======================================================================== */

export interface SocialLinks {
  facebook: string;
  instagram: string;
  twitter: string;
  whatsapp: string;
}

export interface MarketplaceSettings {
  siteName: string;
  logoUrl: string;
  bannerUrl: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  socialLinks: SocialLinks;
  approvalMode: "manual" | "automatic";
  allowEditBeforeApproval: boolean;
  defaultCurrency: string;
  defaultAdDurationDays: number;
}

/* ======================================================================== */
/* Report & Moderation Types                                                */
/* ======================================================================== */

export type ReportSeverity = "low" | "medium" | "high";
export type ReportStatus = "open" | "investigating" | "resolved";

export type ReportReason =
  | "spam"
  | "prohibited"
  | "counterfeit"
  | "offensive"
  | "misleading"
  | "wrong_category"
  | "other";

export interface AdReport {
  id: string;
  adId: string;
  reporterId: string;
  reporterName: string;
  reason: ReportReason;
  description?: string;
  severity: ReportSeverity;
  status: ReportStatus;
  createdAt: string;
}

export type ModerationAction =
  // Ad lifecycle
  | "created"
  | "submitted"
  | "edited"
  | "approved"
  | "rejected"
  | "hidden"
  | "unhidden"
  | "deleted"
  | "restored"
  | "expired"
  | "renewed"
  | "sold"
  // Admin actions
  | "pinned"
  | "unpinned"
  | "featured"
  | "unfeatured"
  // User actions
  | "user_suspended"
  | "user_activated"
  | "user_deleted"
  // Report actions
  | "report_ignored"
  | "report_resolved"
  // Security
  | "login_failed"
  | "admin_login"
  | "username_changed"
  | "profile_edited"
  | "unauthorized_access";

export interface ModerationEvent {
  id: string;
  adId: string;
  action: ModerationAction;
  actorId: string;
  actorName: string;
  note?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  action: ModerationAction;
  actorId: string;
  actorName: string;
  targetType: AuditTargetType;
  targetId: string;
  targetLabel?: string;
  note?: string;
  createdAt: string;
}

export type AuditTargetType = "ad" | "user" | "report" | "category" | "system";

export interface AppNotification {
  id: string;
  type: "report" | "system" | "ad_approved" | "ad_rejected" | "ad_expired";
  title: string;
  body: string;
  time: string;
  read: boolean;
  /** The user ID of the notification recipient. Used for querying a user's notifications. */
  recipientId?: string;
  /** The advertisement this notification relates to. Used for cleanup when an ad is deleted/expired. */
  adId?: string;
  createdAt?: string;
}

/* ======================================================================== */
/* Directory & Analytics Types                                              */
/* ======================================================================== */

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  status: "active" | "suspended";
  joinedDate: string;
  adsCount: number;
  avatar: string;
  /** Public username (display only). */
  username?: string;
  /** Display Name (display only). */
  displayName?: string;
}

export type StatCard = {
  labelKey: string;
  value: string;
  delta: string;
  icon: string;
  tone: "primary" | "secondary" | "tertiary" | "error";
};

/* ======================================================================== */
/* Engagement Types                                                         */
/* ======================================================================== */

export type ReactionType = "like" | "love" | "funny" | "wow" | "sad";

/**
 * Reaction summary consumed by the UI (aggregated counts + viewer state).
 */
export interface ReactionSummary {
  total: number;
  counts: Record<ReactionType, number>;
  viewerReaction: ReactionType | null;
}

/**
 * Reaction row — maps directly to a PostgreSQL row in a `reactions` table.
 * Repository method signatures use this type for persistence operations.
 */
export interface ReactionRow {
  /** Permanent unique identifier. */
  id: string;
  /** The ad this reaction belongs to. */
  adId: string;
  /** References User.id (permanent, never changes). */
  userId: string;
  /** The reaction type selected by the user. */
  type: ReactionType;
  /** ISO timestamp when the reaction was created. */
  createdAt: string;
}

/* ======================================================================== */
/* Favorite Types — maps to PostgreSQL `favorites` table                     */
/* ======================================================================== */

/**
 * Favorite row — maps directly to a PostgreSQL row in a `favorites` table.
 * Repository method signatures use this type for persistence operations.
 */
export interface FavoriteRow {
  /** Permanent unique identifier. */
  id: string;
  /** References User.id (permanent, never changes). */
  userId: string;
  /** References Product.id (the favorited ad). */
  adId: string;
  /** ISO timestamp when the favorite was created. */
  createdAt: string;
}

/* ======================================================================== */
/* Comment Types — flat model with unlimited nested replies                 */
/* ======================================================================== */

export interface CommentAuthor {
  id: string;
  name: string;
  avatar: string;
}

/**
 * Stored comment shape saved in mockDb.comments (flat, supports unlimited nesting via parentId).
 * This is the persistence model — the UI consumes the threaded Comment type instead.
 */
export interface StoredComment {
  /** Permanent unique identifier. */
  id: string;
  /** The ad this comment belongs to. */
  adId: string;
  /** Author reference. */
  author: CommentAuthor;
  /** The parent comment id for replies; null for top-level comments. */
  parentId: string | null;
  /** Comment text content. */
  content: string;
  /** ISO timestamp when created. */
  createdAt: string;
  /** ISO timestamp when last updated (for edits). */
  updatedAt: string;
  /** ISO timestamp when edited (nullable). */
  editedAt: string | null;
  /** Visibility status. */
  status: "visible" | "deleted" | "hidden";
}

/**
 * Threaded comment as consumed by the UI.
 * Built by hooks from the flat StoredComment list returned by the repository.
 */
export interface Comment {
  /** Permanent unique identifier. */
  id: string;
  /** The ad this comment belongs to. */
  adId: string;
  /** The parent comment id; null for top-level comments. */
  parentId: string | null;
  /** Author reference. */
  author: CommentAuthor;
  /** Comment text content. */
  body: string;
  /** ISO timestamp when created. */
  createdAt: string;
  /** Whether this comment has been edited. */
  edited: boolean;
  /** Whether the current viewer is the author of this comment. */
  viewerIsAuthor: boolean;
  /** Nested replies (unlimited depth). */
  replies: Comment[];
}

export interface EngagementStats {
  adId: string;
  views: number;
  reactions: number;
  comments: number;
  favorites: number;
  viewerHasFavorited: boolean | null;
}

/* ======================================================================== */
/* Username Search Result Types                                             */
/* ======================================================================== */

/** A user found in global search. */
export interface SearchResultUser {
  type: "user";
  id: string;
  displayName: string;
  username: string;
  avatar: string;
  adsCount: number;
  joinedAt: string;
  /** Relevance score (higher = more relevant). */
  score: number;
}

/** An ad found in global search. */
export interface SearchResultAd {
  type: "ad";
  id: string;
  title: string;
  price: number;
  currency: string;
  image: string;
  location: string;
  sellerName: string;
  postedAgoHours: number;
  categorySlug: string;
  ownerId?: string;
  /** Relevance score (higher = more relevant). */
  score: number;
}

/** A combined search result (users + ads mixed together). */
export type SearchResult = SearchResultUser | SearchResultAd;