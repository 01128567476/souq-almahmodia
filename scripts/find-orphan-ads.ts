/**
 * Report ads that have no rows in ad_images.
 *
 * These are orphans from failed create() calls — the products insert committed
 * but the ad_images insert then failed, and create() does not wrap the two in a
 * transaction. Read-only: reports, deletes nothing.
 *
 * Run with: npx tsx scripts/find-orphan-ads.ts
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set. Please set it in .env.local");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  const orphans = await sql`
    SELECT p.id, p.title, p.status, p.created_at
    FROM products p
    LEFT JOIN ad_images i ON i.ad_id = p.id
    WHERE i.id IS NULL AND p.status != 'deleted'
    ORDER BY p.created_at DESC
  `;

  console.log(`Ads with zero images: ${(orphans as any).length}\n`);
  for (const row of orphans as any) {
    console.log(`  ${row.id}  ${row.status.padEnd(9)}  ${row.created_at.toISOString?.() ?? row.created_at}  ${row.title}`);
  }
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
