-- Migration: Add credentials-auth columns to users table
-- Required by auth.ts (Credentials provider) and userRepository.hasPassword().
-- These were added to drizzle/schema/tables.ts in the NextAuth v5 migration
-- but never had a corresponding migration file.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_salt" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "has_password" boolean DEFAULT false;
