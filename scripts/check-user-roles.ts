/**
 * Report each user's role as stored in the database.
 *
 * Use this to tell a STALE JWT (cookie says admin, DB says user) apart from a
 * genuine routing bug. Read-only.
 *
 * Run with: npx tsx scripts/check-user-roles.ts
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set. Please set it in .env.local");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  const rows = await sql`
    SELECT id, email, display_name, role, updated_at
    FROM users ORDER BY role, email
  `;

  console.log(`Users: ${(rows as any).length}\n`);
  for (const r of rows as any) {
    console.log(`  ${String(r.role).padEnd(6)}  ${String(r.email).padEnd(34)}  ${r.display_name}  (${r.id})`);
  }
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
