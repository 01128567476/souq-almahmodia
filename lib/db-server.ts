/**
 * Server-only database connection.
 *
 * DO NOT import this file from client components.
 * Use `@/lib/db` for schema-only exports instead.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import pg from "pg";
import * as schema from "@/drizzle/schema";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn("⚠️  DATABASE_URL is not set. The database client will fail at runtime.\n" +
    "    Set it in .env.local, e.g.:\n" +
    "    DATABASE_URL=postgresql://user:pass@localhost:5432/souqna"
  );
}

/**
 * Connection configuration for PostgreSQL.
 * - Neon serverless: Use @neondatabase/serverless (optimized for serverless/edge)
 * - Regular PostgreSQL: Use connection pool with pg
 */
const isNeon = DATABASE_URL?.includes(".neon.tech") ?? false;

let pool: pg.Pool | null = null;
let poolError: Error | null = null;

// For non-Neon databases, create a connection pool with proper timeouts
if (DATABASE_URL && !isNeon) {
  try {
    pool = new pg.Pool({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: 10000, // 10s timeout
            idleTimeoutMillis: 30000, // 30s idle
      max: 5,                         // Max pool size
    });

    // Listen for pool errors
     pool.on("error", (err) => {
     console.error("⚠️  Unexpected error on idle database pool:", err);
      poolError = err as Error;
    });

    pool.on("connect", () => {
      console.log("✅ Database pool connected successfully");
    });
  } catch (err) {
    console.error("❌ Failed to initialize database pool:", err);
    poolError = err as Error;
  }
}

// Drizzle ORM instance
// For Neon: use @neondatabase/serverless (works better with Next.js serverless functions)
// For regular PostgreSQL: use connection pool
export const db = isNeon
  ? drizzle(DATABASE_URL!, { schema }) // drizzle-orm/node-postgres can use the URL directly with Neon
  : (pool ? drizzle(pool, { schema }) : drizzle(DATABASE_URL!, { schema }));

export type Database = typeof db;