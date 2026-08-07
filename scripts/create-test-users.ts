/**
 * Create test users in the database.
 * Run with: npx tsx --env-file=.env.local scripts/create-test-users.ts
 */

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function createTestUsers() {
  console.log("=".repeat(60));
  console.log("CREATE TEST USERS");
  console.log("=".repeat(60));
  console.log();

  // Hash passwords
  const adminPasswordHash = await bcrypt.hash("Admin@123", 10);
  const userPasswordHash = await bcrypt.hash("User@123", 10);

  console.log("Passwords hashed successfully");
  console.log();

  // Step 1: Delete existing test users AND conflicting usernames
  console.log("Removing existing test users and conflicting usernames...");
  await sql`DELETE FROM users WHERE email IN ('admin@gmail.com', 'user@gmail.com')`;
  await sql`DELETE FROM users WHERE username IN ('admin', 'user')`;
  console.log("  ✅ Removed existing test users and conflicting usernames");
  console.log();

  // Step 2: Create Admin user
  console.log("Creating ADMIN user...");
  const now = new Date().toISOString();
  try {
    await sql`
      INSERT INTO users (
        display_name, username, username_lower, email, password_hash, 
        has_password, email_verified, role, avatar, created_at, updated_at
      ) VALUES (
        'Administrator', 'admin', 'admin', 'admin@gmail.com', 
        ${adminPasswordHash}, true, ${now}, 'admin', '', ${now}, ${now}
      )
      ON CONFLICT (email) DO NOTHING
    `;
    console.log("  ✅ Admin user created: admin@gmail.com");
  } catch (e: any) {
    console.log(`  ⚠️  Admin user may already exist: ${e.message}`);
  }
  console.log();

  // Step 3: Create Normal User
  console.log("Creating NORMAL USER...");
  try {
    await sql`
      INSERT INTO users (
        display_name, username, username_lower, email, password_hash,
        has_password, email_verified, role, avatar, created_at, updated_at
      ) VALUES (
        'Test User', 'user', 'user', 'user@gmail.com',
        ${userPasswordHash}, true, ${now}, 'user', '', ${now}, ${now}
      )
      ON CONFLICT (email) DO NOTHING
    `;
    console.log("  ✅ Normal user created: user@gmail.com");
  } catch (e: any) {
    console.log(`  ⚠️  Normal user may already exist: ${e.message}`);
  }
  console.log();

  // Step 4: Verify users
  console.log("Verifying users...");
  const users = await sql`
    SELECT id, display_name, username, email, role, has_password, email_verified, created_at
    FROM users
    WHERE email IN ('admin@gmail.com', 'user@gmail.com')
    ORDER BY email
  `;

  console.log();
  console.log("  Created users:");
  for (const u of users as any[]) {
    console.log(`    - ${u.email}`);
    console.log(`      Display Name: ${u.display_name}`);
    console.log(`      Username: ${u.username}`);
    console.log(`      Role: ${u.role}`);
    console.log(`      Has Password: ${u.has_password}`);
    console.log(`      Email Verified: ${u.email_verified}`);
    console.log(`      Password Hash: ${u.password_hash ? "✅ Yes (" + u.password_hash.length + " chars)" : "❌ No"}`);
  }

  console.log();
  console.log("=".repeat(60));
  console.log("TEST USERS CREATED SUCCESSFULLY");
  console.log("=".repeat(60));
  console.log();
  console.log("Login credentials:");
  console.log("  ADMIN:  admin@gmail.com / Admin@123");
  console.log("  USER:   user@gmail.com / User@123");
}

createTestUsers().catch(console.error);