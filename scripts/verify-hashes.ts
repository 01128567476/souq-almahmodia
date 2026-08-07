/**
 * Verify password hashes exist in the database.
 * Run with: npx tsx --env-file=.env.local scripts/verify-hashes.ts
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
 if (!DATABASE_URL) {
 console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function verify() {
  const users = await sql`
    SELECT email, has_password, password_hash IS NOT NULL as has_hash, length(password_hash::text) as hash_len
    FROM users WHERE email IN ('admin@gmail.com', 'user@gmail.com')


  `;  console.log("Password hash verification:");
  for (const u of users as any[]) {
    console.log(`  ${u.email}:`);
    console.log(`    has_password: ${u.has_password}`);
    console.log(`    has_hash: ${u.has_hash}`);
    console.log(`    hash_length: ${u.hash_len}`);
    console.log(`    hash_prefix: ${(u.password_hash as string)?.substring(0, 20)}`);
    console.log(`    hash_full: ${(u.password_hash as string)?.substring(0, 60)}...`);
  }
}

verify().catch(console.error);