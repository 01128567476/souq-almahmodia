-- Migration: Add email_verified column to users table
-- Required for Auth.js OAuth provider compatibility

-- Add email_verified column
ALTER TABLE "users" ADD COLUMN "email_verified" timestamp;