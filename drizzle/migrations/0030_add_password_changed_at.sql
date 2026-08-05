-- Migration: Add password_changed_at column to users table
-- Purpose: JWT session invalidation on password reset/change
-- Date: 2026-08-05

ALTER TABLE "users" ADD COLUMN "password_changed_at" TIMESTAMP;

-- Index for fast lookups during session validation
CREATE INDEX IF NOT EXISTS idx_users_password_changed_at ON "users" ("password_changed_at");