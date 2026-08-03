CREATE TYPE "public"."ad_status" AS ENUM('pending', 'approved', 'rejected', 'hidden', 'expired', 'sold', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."approval_mode" AS ENUM('manual', 'automatic');--> statement-breakpoint
CREATE TYPE "public"."audit_target_type" AS ENUM('ad', 'user', 'report', 'category', 'system');--> statement-breakpoint
CREATE TYPE "public"."comment_status" AS ENUM('visible', 'deleted', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."moderation_action" AS ENUM('created', 'submitted', 'edited', 'approved', 'rejected', 'hidden', 'unhidden', 'deleted', 'restored', 'expired', 'renewed', 'sold', 'pinned', 'unpinned', 'featured', 'unfeatured', 'user_suspended', 'user_activated', 'user_deleted', 'report_ignored', 'report_resolved', 'login_failed', 'admin_login', 'username_changed', 'profile_edited', 'unauthorized_access');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('report', 'system', 'ad_approved', 'ad_rejected', 'ad_expired');--> statement-breakpoint
CREATE TYPE "public"."product_condition" AS ENUM('new', 'excellent', 'good', 'fair');--> statement-breakpoint
CREATE TYPE "public"."reaction_type" AS ENUM('like', 'love', 'funny', 'wow', 'sad');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('spam', 'prohibited', 'counterfeit', 'offensive', 'misleading', 'wrong_category', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_severity" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'investigating', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('guest', 'user', 'admin');--> statement-breakpoint
CREATE TABLE "ad_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" "moderation_action" NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_name" text NOT NULL,
	"target_type" "audit_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"target_label" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"slug" varchar(100) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_en" text,
	"name_ar" text,
	"icon" text NOT NULL,
	"order" integer DEFAULT 0,
	"hidden" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_id" uuid NOT NULL,
	"parent_id" uuid,
	"author_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"author_avatar" text DEFAULT '',
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"edited_at" timestamp,
	"status" "comment_status" DEFAULT 'visible' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ad_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_id" uuid NOT NULL,
	"action" "moderation_action" NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_name" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"time" text,
	"read" boolean DEFAULT false NOT NULL,
	"recipient_id" uuid NOT NULL,
	"ad_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"category_slug" varchar(100) NOT NULL,
	"description" text,
	"price" numeric(12, 2),
	"currency" text DEFAULT 'SAR',
	"condition" "product_condition" NOT NULL,
	"location" text NOT NULL,
	"seller_name" text NOT NULL,
	"seller_phone" text NOT NULL,
	"status" "ad_status" DEFAULT 'pending' NOT NULL,
	"owner_id" uuid NOT NULL,
	"featured" boolean DEFAULT false,
	"pinned" boolean DEFAULT false,
	"pinned_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"rejection_reason" text,
	"admin_notes" text
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "reaction_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reporter_name" text NOT NULL,
	"reason" "report_reason" NOT NULL,
	"description" text,
	"severity" "report_severity" NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar(50) PRIMARY KEY DEFAULT 'marketplace' NOT NULL,
	"site_name" text DEFAULT 'سوق المحمودية',
	"logo_url" text,
	"banner_url" text,
	"contact_email" text,
	"contact_phone" text,
	"contact_address" text,
	"social_links" text,
	"approval_mode" "approval_mode" DEFAULT 'manual',
	"allow_edit_before_approval" boolean DEFAULT true,
	"default_currency" text DEFAULT 'SAR',
	"default_ad_duration_days" integer DEFAULT 30,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"username" varchar(50) NOT NULL,
	"username_lower" varchar(50) NOT NULL,
	"username_last_changed_at" timestamp,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"avatar" text DEFAULT '',
	"google_id" text,
	"email" text NOT NULL,
	"bio" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"phone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_username_lower_unique" UNIQUE("username_lower"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "idx_ad_images_ad_id" ON "ad_images" USING btree ("ad_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_ad_primary_image" ON "ad_images" USING btree ("ad_id","is_primary");--> statement-breakpoint
CREATE INDEX "idx_audit_actor_id" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_audit_target" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_audit_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_comments_ad_id" ON "comments" USING btree ("ad_id");--> statement-breakpoint
CREATE INDEX "idx_comments_parent_id" ON "comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_comments_author_id" ON "comments" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_favorite" ON "favorites" USING btree ("user_id","ad_id");--> statement-breakpoint
CREATE INDEX "idx_favorites_user_id" ON "favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_favorites_ad_id" ON "favorites" USING btree ("ad_id");--> statement-breakpoint
CREATE INDEX "idx_moderation_ad_id" ON "moderation_events" USING btree ("ad_id");--> statement-breakpoint
CREATE INDEX "idx_moderation_actor_id" ON "moderation_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient" ON "notifications" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_unread" ON "notifications" USING btree ("recipient_id","read");--> statement-breakpoint
CREATE INDEX "idx_notifications_ad_id" ON "notifications" USING btree ("ad_id");--> statement-breakpoint
CREATE INDEX "idx_products_owner_id" ON "products" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_products_status" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_products_category_status" ON "products" USING btree ("category_slug","status");--> statement-breakpoint
CREATE INDEX "idx_products_pinned" ON "products" USING btree ("pinned","pinned_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_products_expires_at" ON "products" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_reaction" ON "reactions" USING btree ("ad_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_reactions_ad_id" ON "reactions" USING btree ("ad_id");--> statement-breakpoint
CREATE INDEX "idx_reactions_user_id" ON "reactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_reports_ad_id" ON "reports" USING btree ("ad_id");--> statement-breakpoint
CREATE INDEX "idx_reports_status" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_reports_reporter_id" ON "reports" USING btree ("reporter_id");