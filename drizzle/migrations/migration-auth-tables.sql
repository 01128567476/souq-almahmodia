-- ============================================================
-- Authentication Tables Migration
-- Creates: accounts, email_verification_tokens, otp_tokens, password_reset_tokens
--  ============================================================

--1. Accounts (OAuth provider bindings)
CREATE TABLE IF NOT EXISTS "accounts" (
  "provider_id" varchar(100) NOT NULL,
  "provider_user_id" varchar(256) NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "access_token" text,
  "refresh_token" text,
  "access_token_expiry" timestamp,
  "scope" text,
  "id_token" text,
  "session_id" varchar(256),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes for accounts
CREATE UNIQUE INDEX IF NOT EXISTS "unique_provider_account" ON "accounts" USING btree ("provider_id", "provider_user_id");
CREATE INDEX IF NOT EXISTS "idx_accounts_user_id" ON "accounts" USING btree ("user_id");

-- 2. Email Verification Tokens
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "email" varchar(256) NOT NULL,
  "token_hash" varchar(256) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes for email_verification_tokens
CREATE INDEX IF NOT EXISTS "idx_email_verif_token_hash" ON "email_verification_tokens" USING btree ("token_hash");
CREATE INDEX IF NOT EXISTS "idx_email_verif_user_id" ON "email_verification_tokens" USING btree ("user_id", "used_at");

-- 3. OTP Tokens
CREATE TABLE IF NOT EXISTS "otp_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "email" varchar(256) NOT NULL,
  "channel" varchar(10) DEFAULT 'email' NOT NULL,
  "code" varchar(256) NOT NULL,
  "token_hash" varchar(256) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "failed_attempts" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes for otp_tokens
CREATE INDEX IF NOT EXISTS "idx_otp_token_hash" ON "otp_tokens" USING btree ("token_hash");
CREATE INDEX IF NOT EXISTS "idx_otp_user_id" ON "otp_tokens" USING btree ("user_id", "channel", "used_at");

-- 4. Password Reset Tokens
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "token" varchar(256) PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expires_at" timestamp NOT NULL,
  "used" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Index for password_reset_tokens
CREATE INDEX IF NOT EXISTS "idx_password_reset_user_id" ON "password_reset_tokens" USING btree ("user_id");