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
   uniqueIndex,
 integer,
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
/* 2. EMAIL VERIFICATION TOKENS                                       */
/* ------------------------------------------------------------------ */

/**
 * Email verification tokens.
 *
 * Used for the email verification flow. Tokens are:
 * - 32-byte cryptographically random values
 * - SHA-256 hashed in the database (never stored in plaintext)
 * - 24-hour expiration
 * - One-time use (invalidated after verification)
 * - Bound to user ID and email for replay prevention
 */
export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    /** Opaque unique ID (PK). */
    id: uuid("id").primaryKey().defaultRandom(),

    /** FK to users.id. */
    userId: uuid("user_id").notNull(),

    /** Email address this token verifies (lowercased). */
    email: varchar("email", { length: 256 }).notNull(),

    /** SHA-256 hash of the raw token (never stores plaintext). */
    tokenHash: varchar("token_hash", { length: 256 }).notNull(),

    /** When this token expires (24 hours from creation). */
    expiresAt: timestamp("expires_at").notNull(),

    /** When the token was consumed (one-time use). Null = unused. */
    usedAt: timestamp("used_at"),

    /** Timestamp. */
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    /** Index: look up token by hash (verification lookup). */
    idxEmailVerifTokenHash: index("idx_email_verif_token_hash").on(t.tokenHash),

    /** Index: look up unused tokens by userId (resend invalidation). */
    idxEmailVerifUserId: index("idx_email_verif_user_id").on(t.userId, t.usedAt),
  })
);

/* ------------------------------------------------------------------ */
/* 3. OTP TOKENS                                                      */
/* ------------------------------------------------------------------ */

/**
 * OTP (One-Time Password) tokens.
 *
 * Used for email/SMS OTP verification flows.
 * Tokens are:
 * - 6-digit numeric codes
 * - SHA
-256 hashed in the database * - 10-minute expiration
 * - One-time use
 * - Rate limited (max 5 per user per 15 minutes)
 */
export const otpTokens = pgTable(
  "otp_tokens",
  {
    /** Opaque unique ID (PK). */
    id: uuid("id").primaryKey().defaultRandom(),

    /** FK to users.id. */
    userId: uuid("user_id").notNull(),

    /** Email address this OTP is for. */
    email: varchar("email", { length: 256 }).notNull(),

    /** Delivery channel: "email" or "sms". */
    channel: varchar("channel", { length: 10 }).notNull().default("email"),

    /** The actual OTP code (hashed with SHA-256). */
    code: varchar("code", { length: 10 }).notNull(),

    /** SHA-256 hash of the OTP code. */
    tokenHash: varchar("token_hash", { length: 256 }).notNull(),

    /** When this token expires (10 minutes from creation). */
    expiresAt: timestamp("expires_at").notNull(),

    /** When the token was consumed (one-time use). Null = unused. */
    usedAt: timestamp("used_at"),

    /** Number of failed verification attempts. */
    failedAttempts: integer("failed_attempts").default(0).notNull(),

    /** Timestamp. */
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    /** Index: look up token by hash. */
    idxOtpTokenHash: index("idx_otp_token_hash").on(t.tokenHash),

    /** Index: look up active tokens by userId + channel. */
    idxOtpUserId: index("idx_otp_user_id").on(t.userId, t.channel, t.usedAt),
  })
);

/* ------------------------------------------------------------------ */
/* 4. PASSWORD RESET TOKENS                                           */
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