/**
 * Auth schema definitions - production OAuth and password reset support.
 *
 * This module defines the accounts and password_reset_tokens tables
 * for the authentication foundation. These tables are Auth.js compatible
 * and will be used directly when Auth.js JWT sessions are integrated.
 *
 * Tables:
 *   - accounts             : stores OAuth provider bindings (Google, etc.)
 *   - password_reset_tokens : used for future password reset flow
 *
 * Session management uses Auth.js JWT strategy (no database session table).
 * Neither table conflicts with existing tables.
 */

import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  uuid,
  index,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* 1. ACCOUNTS (OAuth provider bindings)                              */
/* ------------------------------------------------------------------ */

/**
 * OAuth account bindings for users.
 *
 * This schema mirrors Auth.js (NextAuth v5) account table structure
 * so the migration path is straightforward.
 */
export const accounts = pgTable(
  "accounts",
  {
    /** Provider ID (e.g. "google"). */
    providerId: varchar("provider_id", { length: 100 }).notNull(),

    /** Provider user ID (external, e.g. Google sub). */
    providerUserId: varchar("provider_user_id", { length: 256 }).notNull(),

    /** FK to users.id. */
    userId: uuid("user_id").notNull(),

    /** Provider access token (may be null for PKCE flows). */
    accessToken: text("access_token"),

    /** Provider refresh token. */
    refreshToken: text("refresh_token"),

    /** Provider access token expiry. */
    accessTokenExpiry: timestamp("access_token_expiry"),

    /** Provider scope. */
    scope: text("scope"),

    /** OAuth ID token (JWT from provider). */
    idToken: text("id_token"),

    /** Session ID (optional). */
    sessionId: varchar("session_id", { length: 256 }),

    /** Timestamp. */
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    /** Unique: one provider account per user per provider. */
    uniqueProviderAccount: index("unique_provider_account").on(t.providerId, t.providerUserId),

    /** Index: look up accounts by userId. */
    idxAccountsUserId: index("idx_accounts_user_id").on(t.userId),
  })
);

/* ------------------------------------------------------------------ */
/* 2. PASSWORD RESET TOKENS                                           */
/* ------------------------------------------------------------------ */

/**
 * Password reset tokens.
 *
 * Used for the future password reset flow. Tokens are single-use
 * and expire after a configurable window (default 1 hour).
 */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    /** Opaque token. */
    token: varchar("token", { length: 256 }).primaryKey(),

    /** FK to users.id. */
    userId: uuid("user_id").notNull(),

    /** When this token expires. */
    expiresAt: timestamp("expires_at").notNull(),

    /** Whether the token has been used. */
    used: boolean("used").default(false).notNull(),

    /** Timestamp. */
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    /** Index: look up by userId (listing revoked tokens). */
    idxPasswordResetUserId: index("idx_password_reset_user_id").on(t.userId),
  })
);