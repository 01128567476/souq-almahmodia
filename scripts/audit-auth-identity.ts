/**
 * Auth identity audit — READ ONLY.
 *
 * Detects the data-level failure modes that cause role mismatch between
 * Credentials login and Google OAuth login:
 *
 *   1. Duplicate emails (exact)
 *   2. Duplicate emails differing only by case (Postgres UNIQUE is case-sensitive,
 *      so 'Admin@x.com' and 'admin@x.com' are two legal rows = two identities)
 *   3. Rows whose email is not stored lowercased (breaks getByEmail lookups)
 *   4. Duplicate / colliding google_id values
 *   5. Full identity picture per user (role, google_id, has_password)
 *
 * Run: npx tsx --env-file=.env.local scripts/audit-auth-identity.ts
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with: npx tsx --env-file=.env.local scripts/audit-auth-identity.ts");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

function section(title: string) {
  console.log();
  console.log("=".repeat(64));
  console.log(title);
  console.log("=".repeat(64));
}

async function main() {
  section("1. EXACT DUPLICATE EMAILS");
  const exactDupes = (await sql`
    SELECT email, COUNT(*)::int AS count
    FROM users
    GROUP BY email
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `) as any[];
  if (exactDupes.length === 0) {
    console.log("  OK - no exact duplicate emails");
  } else {
    for (const r of exactDupes) console.log(`  DUPLICATE: ${r.email} x${r.count}`);
  }

  section("2. CASE-INSENSITIVE DUPLICATE EMAILS (identity split risk)");
  const caseDupes = (await sql`
    SELECT LOWER(email) AS lower_email,
           COUNT(*)::int AS count,
           STRING_AGG(email, ' | ') AS variants,
           STRING_AGG(role::text, ' | ') AS roles,
           STRING_AGG(id::text, ' | ') AS ids
    FROM users
    GROUP BY LOWER(email)
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `) as any[];
  if (caseDupes.length === 0) {
    console.log("  OK - no case-variant duplicate emails");
  } else {
    for (const r of caseDupes) {
      console.log(`  SPLIT IDENTITY: ${r.lower_email} x${r.count}`);
      console.log(`     variants : ${r.variants}`);
      console.log(`     roles    : ${r.roles}`);
      console.log(`     ids      : ${r.ids}`);
    }
  }

  section("3. NON-LOWERCASE EMAILS (breaks getByEmail lookup)");
  const notLower = (await sql`
    SELECT id, email, role::text AS role
    FROM users
    WHERE email <> LOWER(email)
  `) as any[];
  if (notLower.length === 0) {
    console.log("  OK - all emails stored lowercase");
  } else {
    for (const r of notLower) console.log(`  NOT LOWERCASE: ${r.email} (role=${r.role}, id=${r.id})`);
  }

  section("4. DUPLICATE GOOGLE IDs");
  const gidDupes = (await sql`
    SELECT google_id, COUNT(*)::int AS count, STRING_AGG(email, ' | ') AS emails
    FROM users
    WHERE google_id IS NOT NULL AND google_id <> ''
    GROUP BY google_id
    HAVING COUNT(*) > 1
  `) as any[];
  if (gidDupes.length === 0) {
    console.log("  OK - no duplicate google_id");
  } else {
    for (const r of gidDupes) console.log(`  DUPLICATE google_id=${r.google_id} -> ${r.emails}`);
  }

  section("5. EMPTY-STRING GOOGLE IDs (collide on UNIQUE, block linking)");
  const emptyGid = (await sql`
    SELECT id, email, role::text AS role FROM users WHERE google_id = ''
  `) as any[];
  if (emptyGid.length === 0) {
    console.log("  OK - no empty-string google_id");
  } else {
    for (const r of emptyGid) console.log(`  EMPTY google_id: ${r.email} (role=${r.role})`);
  }

  section("6. NULL / INVALID ROLES");
  const badRoles = (await sql`
    SELECT id, email, role::text AS role FROM users WHERE role IS NULL
  `) as any[];
  console.log(badRoles.length === 0 ? "  OK - no null roles" : `  ${badRoles.length} rows with NULL role`);

  section("7. FULL IDENTITY TABLE");
  const all = (await sql`
    SELECT id, email, role::text AS role, google_id, has_password,
           email_verified, password_changed_at, created_at
    FROM users
    ORDER BY LOWER(email), created_at
  `) as any[];
  console.log(`  total users: ${all.length}`);
  console.log();
  for (const u of all) {
    console.log(
      `  ${u.email}\n` +
        `      role=${u.role}  hasPassword=${u.has_password}  googleId=${u.google_id ?? "NULL"}\n` +
        `      emailVerified=${u.email_verified ?? "NULL"}  passwordChangedAt=${u.password_changed_at ?? "NULL"}\n` +
        `      id=${u.id}`
    );
  }

  section("8. UNIQUE CONSTRAINTS ON users");
  const cons = (await sql`
    SELECT tc.constraint_name,
           STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = 'users'
      AND tc.constraint_type = 'UNIQUE'
    GROUP BY tc.constraint_name
    ORDER BY columns
  `) as any[];
  for (const c of cons) console.log(`  UNIQUE(${c.columns})  [${c.constraint_name}]`);

  const ciIndex = (await sql`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename = 'users' AND indexdef ILIKE '%lower%email%'
  `) as any[];
  console.log();
  console.log(
    ciIndex.length > 0
      ? `  case-insensitive email index PRESENT: ${ciIndex[0].indexname}`
      : "  MISSING: no UNIQUE index on LOWER(email) -> case-variant duplicates are possible"
  );

  console.log();
  console.log("AUDIT COMPLETE (no rows were modified)");
}

main().catch((e) => {
  console.error("Audit failed:", e);
  process.exit(1);
});
