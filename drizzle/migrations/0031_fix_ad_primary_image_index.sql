-- Fix: unique_ad_primary_image capped every ad at 2 images.
--
-- The original index (0000_new_bromley.sql:171) was:
--   CREATE UNIQUE INDEX "unique_ad_primary_image" ON "ad_images" ("ad_id","is_primary");
--
-- The intent was "one primary image per ad", but uniquing the PAIR also uniques
-- (ad_id, false) — so an ad could hold at most one primary + one non-primary row.
-- Inserting a 3rd image raised:
--   duplicate key value violates unique constraint "unique_ad_primary_image"
--
-- The correct form is a PARTIAL unique index constraining only primary rows.
-- The new constraint is strictly weaker than the old one, so no existing row can
-- violate it and no data cleanup is required.

DROP INDEX IF EXISTS "unique_ad_primary_image";--> statement-breakpoint
CREATE UNIQUE INDEX "unique_ad_primary_image" ON "ad_images" USING btree ("ad_id") WHERE "is_primary";
