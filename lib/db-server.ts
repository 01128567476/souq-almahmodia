/**
 * Server-only database connection.
 *
 * DO NOT import this file from client components.
 * Use `@/lib/db` for schema-only exports instead.
 */

import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "@/drizzle/schema";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn("⚠️  DATABASE_URL is not set. The database client will fail at runtime.\n" +
    "    Set it in .env.local, e.g.:\n" +
    "    DATABASE_URL=postgresql://user:pass@localhost:5432/souqna"
  );
}

/**
 * Connection configuration for Neon serverless.
 * Uses @neondatabase/serverless Pool (WebSocket-based) + drizzle-orm/neon-serverless
 */
const isNeon = DATABASE_URL?.includes(".neon.tech") ?? false;

// For Neon: use @neondatabase/serverless Pool (WebSocket-based connection pool)
let neonPool: Pool | null = null;
if (DATABASE_URL && isNeon) {
  try {
    neonPool = new Pool({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: 10000,
    });
    console.log("✅ Neon pool connected successfully");
   } catch (err) {
   console.error("❌ Failed to initialize Neon pool:", err);
  }
}

// Drizzle ORM instance using native neon-serverless adapter
export const db = isNeon
  ? (neonPool ? drizzle(neonPool, { schema }) : drizzle(DATABASE_URL!))
  : drizzle(DATABASE_URL!);

export type Database = typeof db;