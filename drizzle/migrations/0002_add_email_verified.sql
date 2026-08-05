-- Migration: Add email_verified column to users table
-- Required for Auth.js OAuth provider compatibility

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" timestamp;
