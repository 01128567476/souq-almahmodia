/**
 * Fix the unique_ad_primary_image index.
 *
 * The original index uniqued the PAIR (ad_id, is_primary), which capped every ad
 * at 2 images. Replaces it with a PARTIAL unique index that constrains only
 * primary rows — the actual intent of "one primary image per ad".
 *
 * Run with: npx tsx scripts/fix-ad-primary-image-index.ts
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set. Please set it in .env.local");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  const dbInfo = await sql`SELECT current_database() AS db, current_user AS usr`;
  console.log(`Connected to "${(dbInfo as any)[0].db}" as "${(dbInfo as any)[0].usr}"\n`);

  const before = await sql`
    SELECT indexdef FROM pg_indexes
    WHERE tablename = 'ad_images' AND indexname = 'unique_ad_primary_image'
  `;
  console.log("BEFORE:", (before as any)[0]?.indexdef ?? "(index not present)");

  // Safety check: confirm no ad currently holds >1 primary image, which would
  // make the new partial unique index fail to build.
  const dupes = await sql`
    SELECT ad_id, COUNT(*) AS n FROM ad_images
    WHERE is_primary GROUP BY ad_id HAVING COUNT(*) > 1
  `;
  if ((dupes as any).length > 0) {
    console.error("\n❌ Aborting — these ads have multiple primary images:");
    console.error(dupes);
    process.exit(1);
  }

  await sql`DROP INDEX IF EXISTS "unique_ad_primary_image"`;
  await sql`
    CREATE UNIQUE INDEX "unique_ad_primary_image"
    ON "ad_images" USING btree ("ad_id") WHERE "is_primary"
  `;

  const after = await sql`
    SELECT indexdef FROM pg_indexes
    WHERE tablename = 'ad_images' AND indexname = 'unique_ad_primary_image'
  `;
  console.log("AFTER: ", (after as any)[0]?.indexdef ?? "(index missing!)");
  console.log("\n✅ Index replaced.");
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
