/**
 * Schema-only exports for use in both client and server code.
 *
 * This file does NOT import `pg` or `drizzle-orm/node-postgres`,
 * so it can be safely imported from client components.
 */

export * from "@/drizzle/schema";

/** DB instance type — available on server, undefined on client. */
export type Database = any;

/** DB client — populated server-side at runtime. */
export let db: Database | null = null;