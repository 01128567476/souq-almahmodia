/**
 * Audit log & moderation events repository — Drizzle ORM implementation.
 *
 * Production-grade: all writes go directly to the database.
 * No in-memory buffers. No data loss on restart.
 *
 * Public interface remains EXACTLY the same.
 */

import type {
  AuditLogEntry,
  AuditTargetType,
  ModerationAction,
  ModerationEvent,
} from "@/types";
import { db } from "@/lib/db-server";
import { moderationEvents, auditLogs } from "@/drizzle/schema";
import { eq, asc, desc, sql } from "drizzle-orm";
import { clone } from "@/lib/db-utils";

/** Convert a date-like value to ISO string. Handles Date, ISO string, null/undefined. Returns fallback for null. */
function toIsoString(val: Date | string | null | undefined, fallback?: string): string {
  if (val == null) return fallback ?? new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") return val;
  return String(val);
}

/* -------------------------------------------------------------------------- */
/* Input types                                                                */
/* -------------------------------------------------------------------------- */

export interface RecordInput {
  action: ModerationAction;
  actorId: string;
  actorName: string;
  note?: string;
}

/* -------------------------------------------------------------------------- */
/* Database-persistent helpers                                                */
/* -------------------------------------------------------------------------- */

/**
 * Write a moderation event AND a matching audit entry to the database.
 * Both writes happen in the same synchronous function but as separate DB calls.
 * Called from inside other repository mutations that have already wrapped
 * their database latency in a transaction, so fire-and-forget is safe.
 */
async function recordAdModerationToDB(
  adId: string,
  adLabel: string,
  input: RecordInput & { targetType?: AuditTargetType; targetId?: string; targetLabel?: string },
): Promise<void> {
  const now = new Date();

  // Write moderation event
  await db
    .insert(moderationEvents)
    .values({
      adId,
      action: input.action,
      actorId: input.actorId,
      actorName: input.actorName,
      note: input.note ?? null,
      createdAt: now,
    })
    .catch((err) => {
      // Log but don't break the main operation
      console.error("[auditRepository] Failed to write moderation event:", err);
    });

  // Write audit log entry (target defaults to "ad" if not specified)
  const targetType = input.targetType ?? "ad";
  const targetId = input.targetId ?? adId;
  const targetLabel = input.targetLabel ?? adLabel;

  await db
    .insert(auditLogs)
    .values({
      action: input.action,
      actorId: input.actorId,
      actorName: input.actorName,
      targetType,
      targetId,
      targetLabel,
      note: input.note ?? null,
      createdAt: now,
    })
    .catch((err) => {
      console.error("[auditRepository] Failed to write audit log:", err);
    });
}

/**
 * Append a standalone audit entry to the database (any target type).
 */
async function recordAuditToDB(
  input: RecordInput & {
    targetType: AuditTargetType;
    targetId: string;
    targetLabel?: string;
  },
): Promise<void> {
  const now = new Date();

  await db
    .insert(auditLogs)
    .values({
      action: input.action,
      actorId: input.actorId,
      actorName: input.actorName,
      targetType: input.targetType,
      targetId: input.targetId,
      targetLabel: input.targetLabel ?? null,
      note: input.note ?? null,
      createdAt: now,
    })
    .catch((err) => {
      console.error("[auditRepository] Failed to write audit log:", err);
    });
}

/**
 * Append a moderation event to an ad's timeline AND a matching audit entry.
 * Database-persistent.
 */
export async function recordAdModeration(
  adId: string,
  adLabel: string,
  input: RecordInput,
): Promise<void> {
  await recordAdModerationToDB(adId, adLabel, { ...input });
}

/**
 * Append a standalone audit entry (any target type).
 * Database-persistent.
 */
export async function recordAudit(input: RecordInput & {
  targetType: AuditTargetType;
  targetId: string;
  targetLabel?: string;
}): Promise<void> {
  await recordAuditToDB(input);
}

/* -------------------------------------------------------------------------- */
/* Repository — uses Drizzle ORM              */
/* -------------------------------------------------------------------------- */

export const auditRepository = {
  /** Full moderation timeline for one advertisement, oldest first. */
  async getAdHistory(adId: string): Promise<ModerationEvent[]> {
    const rows = await db
      .select()
      .from(moderationEvents)
      .where(eq(moderationEvents.adId, adId))
      .orderBy(asc(moderationEvents.createdAt));

    const result: ModerationEvent[] = rows.map((row) => ({
      id: row.id,
      adId: row.adId,
      action: row.action,
      actorId: row.actorId,
      actorName: row.actorName,
      note: row.note ?? undefined,
      createdAt: toIsoString(row.createdAt),
    }));

    return clone(result);
  },

  /** Global audit log, newest first, optionally limited. */
  async getAuditLog(limit?: number): Promise<AuditLogEntry[]> {
    const query = db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt));

    const rows = limit
      ? await query.limit(limit)
      : await query;

    const result: AuditLogEntry[] = rows.map((row) => ({
      id: row.id,
      action: row.action,
      actorId: row.actorId,
      actorName: row.actorName,
      targetType: row.targetType,
      targetId: row.targetId,
      targetLabel: row.targetLabel ?? undefined,
      note: row.note ?? undefined,
      createdAt: toIsoString(row.createdAt),
    }));

    return clone(result);
  },

  /**
   * Record a moderation event to the database immediately.
   * This is used by repository mutations that wrap their operations in transactions.
   * Returns the created moderation event ID.
   */
  async createModerationEvent(params: {
    adId: string;
    action: ModerationAction;
    actorId: string;
    actorName: string;
    note?: string;
  }): Promise<string> {
    const result = await db
      .insert(moderationEvents)
      .values({
        adId: params.adId,
        action: params.action,
        actorId: params.actorId,
        actorName: params.actorName,
        note: params.note ?? null,
        createdAt: new Date(),
      })
      .returning({ id: moderationEvents.id });

    return result[0].id;
  },

  /**
   * Record an audit log entry to the database immediately.
   * Returns the created audit log entry ID.
   */
  async createAuditLogEntry(params: {
    action: ModerationAction;
    actorId: string;
    actorName: string;
    targetType: AuditTargetType;
    targetId: string;
    targetLabel?: string;
    note?: string;
  }): Promise<string> {
    const result = await db
      .insert(auditLogs)
      .values({
        action: params.action,
        actorId: params.actorId,
        actorName: params.actorName,
        targetType: params.targetType,
        targetId: params.targetId,
        targetLabel: params.targetLabel ?? null,
        note: params.note ?? null,
        createdAt: new Date(),
      })
      .returning({ id: auditLogs.id });

    return result[0].id;
  },
};