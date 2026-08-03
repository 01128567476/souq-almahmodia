CREATE TABLE "pins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"is_pinned" boolean DEFAULT true NOT NULL,
	"expiry_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "idx_pins_ad_id" ON "pins" USING btree ("ad_id");
CREATE INDEX "idx_pins_owner_id" ON "pins" USING btree ("owner_id");
CREATE INDEX "idx_pins_expiry_date" ON "pins" USING btree ("expiry_date");

CREATE TABLE "user_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"theme" text DEFAULT 'light',
	"language" text DEFAULT 'ar',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "unique_settings_user_id" ON "user_settings" USING btree ("user_id");

CREATE TABLE "username_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"username" varchar(50) NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);