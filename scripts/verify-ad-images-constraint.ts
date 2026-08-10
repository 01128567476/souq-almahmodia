/**
 * Verify the ad_images constraints allow N images per ad with exactly one primary.
 *
 * Inserts throwaway rows under a synthetic ad_id, asserts the expected behaviour,
 * then deletes them. Leaves no data behind.
 *
 * Run with: npx tsx scripts/verify-ad-images-constraint.ts
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set. Please set it in .env.local");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const TEST_AD = "00000000-0000-4000-8000-00000000dead";

async function cleanup() {
  await sql`DELETE FROM ad_images WHERE ad_id = ${TEST_AD}`;
}

async function main() {
  await cleanup();

  // 1. Three images, one primary — must now succeed.
  await sql`
    INSERT INTO ad_images (ad_id, image_url, sort_order, is_primary) VALUES
      (${TEST_AD}, 'https://example.test/a.jpg', 0, true),
      (${TEST_AD}, 'https://example.test/b.jpg', 1, false),
      (${TEST_AD}, 'https://example.test/c.jpg', 2, false)
  `;
  const rows = await sql`SELECT COUNT(*)::int AS n FROM ad_images WHERE ad_id = ${TEST_AD}`;
  console.log(`✅ 3-image insert succeeded (${(rows as any)[0].n} rows) — the original bug is fixed.`);

  // 2. A second primary for the same ad must still be rejected.
  try {
    await sql`
      INSERT INTO ad_images (ad_id, image_url, sort_order, is_primary)
      VALUES (${TEST_AD}, 'https://example.test/d.jpg', 3, true)
    `;
    console.error("❌ Second primary image was ACCEPTED — constraint is too weak.");
    await cleanup();
    process.exit(1);
  } catch (err: any) {
    if (String(err.message).includes("unique_ad_primary_image")) {
      console.log("✅ Second primary image correctly rejected — intent preserved.");
    } else {
      throw err;
    }
  }

  await cleanup();
  const left = await sql`SELECT COUNT(*)::int AS n FROM ad_images WHERE ad_id = ${TEST_AD}`;
  console.log(`🧹 Cleaned up (${(left as any)[0].n} test rows remain).`);
}

main().catch(async (err) => {
  console.error("❌ Failed:", err.message);
  await cleanup().catch(() => {});
  process.exit(1);
});
