/**
 * Script to delete a user by email address.
 * Usage: npx tsx scripts/delete-user-by-email.ts <email>
 */

import "dotenv/config";
import { db } from "@/lib/db-server";
import { users, products } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

async function deleteUserByEmail(email: string) {
  try {
    // Find user by email
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (userRows.length === 0) {
      console.log(`❌ User with email ${email} not found`);
      process.exit(0);
    }

    const user = userRows[0];
    console.log(`📧 Found user:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.displayName}`);
    console.log(`   Username: ${user.username}`);

    // Delete user's ads
    console.log(`   Deleting ads for user ${user.id}...`);

    // Delete ads
    await db
      .delete(products)
      .where(eq(products.ownerId, user.id));

    // Delete user
    await db
      .delete(users)
      .where(eq(users.id, user.id));

    console.log(`✅ User ${email} deleted successfully`);
  } catch (error) {
    console.error("❌ Error deleting user:", error);
    process.exit(1);
  }
}

const email = process.argv[2];
if (!email) {
  console.log("Usage: npx ts-node scripts/delete-user-by-email.ts <email>");
  process.exit(1);
}

deleteUserByEmail(email);