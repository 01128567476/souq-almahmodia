/**
 * Database connection module — single Drizzle client for PostgreSQL.
 *
 * Uses @neondatabase/serverless for serverless Neon PostgreSQL connections.
 * This is the ONLY module that creates the database client.
 * All other modules import from here via drizzle().
 *
 * Drizzle ORM + PostgreSQL + Neon Serverless.
 */

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

/**
 * Drizzle ORM database instance.
 * Export this single instance everywhere database access is needed.
 * Do NOT create additional drizzle() calls — they would create duplicate connections.
 */
const DATABASE_URL =
  typeof process !== "undefined"
    ? process.env.DATABASE_URL
    : "";

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Create a .env file with DATABASE_URL=postgresql://...\nSee .env.example for the template."
  );
}

export const db = drizzle(neon(DATABASE_URL));

/**
 * Re-export common Drizzle helpers for convenience.
 */
export {
  eq, inArray, not, isNull, isNotNull,
  and, or, gte, lte, gt, lt, like, ilike,
  asc, desc, count, sum,
} from "drizzle-orm";