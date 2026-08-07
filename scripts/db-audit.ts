/**
 * Database Audit Script
 * 
 * Connects to the application database and runs audit queries.
 * Run with: npx tsx scripts/db-audit.ts
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

 if (!DATABASE_URL) {
 console.error("❌ DATABASE_URL is not set. Please set it in .env.local");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function runAudit() {
  console.log("=".repeat(60));
  console.log("DATABASE AUDIT REPORT");
  console.log("=".repeat(60));
  console.log();

  // ===== STEP 1: DATABASE INFO =====
  console.log("STEP 1 - DATABASE INFORMATION");
  console.log("-".repeat(40));

  try {
    const dbInfo = await sql`SELECT current_database() as database_name, current_user as current_user, version() as version`;
    console.log(`  Database Name: ${(dbInfo as any)[0].database_name}`);
    console.log(`  Connected User: ${(dbInfo as any)[0].current_user}`);
    console.log(`  Version: ${((dbInfo as any)[0].version as string).substring(0, 80)}...`);
  } catch (error: any) {
    console.log(`  ❌ Error getting database info: ${error.message}`);
  }
  console.log();

  // ===== STEP 2: CHECK TABLES =====
  console.log("STEP 3 - TABLES CHECK");
  console.log("-".repeat(40));

  try {
    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
    const foundTables = (tables as any[]).map((t: any) => t.table_name);
    const expectedTables = ["users", "accounts", "otp_tokens", "email_verification_tokens", "password_reset_tokens", "audit_logs"];

    for (const table of expectedTables) {
      const exists = foundTables.includes(table);
      const status = exists ? "✅" : "❌";
      console.log(`  ${status} ${table}`);
    }
  } catch (error: any) {
    console.log(`  ❌ Error checking tables: ${error.message}`);
  }
  console.log();

  // ===== STEP 3: CHECK USERS TABLE COLUMNS =====
  console.log("STEP 2 - USERS TABLE COLUMNS");
  console.log("-".repeat(40));

  try {
    const columns = await sql`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`;
    const foundColumns = (columns as any[]).map((c: any) => c.column_name);
    const expectedColumns = [
      "id", "display_name", "username", "username_lower", "username_last_changed_at",
      "joined_at", "avatar", "google_id", "email", "email_verified", "bio",
      "role", "phone", "password_hash", "password_salt", "has_password",
      "password_changed_at", "created_at", "updated_at"
    ];

    for (const col of expectedColumns) {
      const exists = foundColumns.includes(col);
      const status = exists ? "✅" : "❌";
      console.log(`  ${status} ${col}`);
    }

    // Show unique constraints
    console.log();
    console.log("  UNIQUE constraints on users:");
    const constraints = await sql`
      SELECT tc.constraint_name, tc.constraint_type,
             STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'users' AND tc.constraint_type = 'UNIQUE'
      GROUP BY tc.constraint_name, tc.constraint_type
    `;
    for (const c of (constraints as any[])) {
      console.log(`  ✅ ${c.columns} (${c.constraint_type})`);
    }
  } catch (error: any) {
    console.log(`  ❌ Error checking users columns: ${error.message}`);
  }
  console.log();

  // ===== STEP 4: CHECK USER COUNT =====
  console.log("STEP 4 - USER COUNT");
  console.log("-".repeat(40));

  try {
    const countResult = await sql`SELECT COUNT(*) as total FROM users`;
    console.log(`  Total users: ${(countResult as any)[0].total}`);

    const users = await sql`SELECT id, display_name, username, email, role, has_password, email_verified FROM users ORDER BY created_at`;
    const userList = users as any[];

    if (userList.length > 0) {
      console.log();
      console.log("  Existing users:");
      for (const u of userList) {
        console.log(`    - ${u.email} (${u.role}) - hasPassword: ${u.has_password}, emailVerified: ${u.email_verified}`);
      }
    }
  } catch (error: any) {
    console.log(`  ❌ Error getting user count: ${error.message}`);
  }
  console.log();

  // ===== STEP 5: CHECK OTHER TABLES =====
  console.log("STEP 5 - OTHER TABLES");
  console.log("-".repeat(40));

  const otherTables = ["accounts", "otp_tokens", "email_verification_tokens", "password_reset_tokens", "audit_logs"];

  for (const table of otherTables) {
    try {
      const result = await sql`SELECT COUNT(*) as total FROM ${sql(table as any)}`;
      console.log(`  ✅ ${table}: ${(result as any)[0].total} rows`);
    } catch (e: any) {
      console.log(`  ❌ ${table}: TABLE NOT FOUND - ${e.message}`);
    }
  }

  console.log();
  console.log("=".repeat(60));
  console.log("AUDIT COMPLETE");
  console.log("=".repeat(60));
}

runAudit().catch(console.error);