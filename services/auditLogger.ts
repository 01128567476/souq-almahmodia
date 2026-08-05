/**
 * Audit logging service — Drizzle ORM implementation.
 *
 * Records every admin and sensitive user action to the PostgreSQL database's
 * audit_logs and moderation_events tables via Drizzle ORM.
 *
 * Logged actions:
 *  - Approve, reject, hide, unhide, pin, unpin, feature, unfeature
 *  - Delete (ad, user, comment, category, report)
 *  - Create (ad, comment, category, report)
 *  - Edit (ad, profile, settings, category)
 *  - User suspension / activation
 *  - Report ignore / resolve
 */

import type {
  AuditLogEntry,
  ModerationAction,
  AuditTargetType,
} from "@/types";
import { db } from "@/lib/db-server";
import { auditLogs, moderationEvents } from "@/drizzle/schema";

/* -------------------------------------------------------------------------- */
/* Core logging                                                               */
/* -------------------------------------------------------------------------- */

interface AuditLogParams {
  /** Id of the actor performing the action (admin or user). */
  actorId: string;
  /** Denormalized actor name. */
  actorName: string;
  /** The moderation action performed. */
  action: ModerationAction;
  /** Type of entity targeted (ad, user, report, category). */
  targetType: AuditTargetType;
  /** ID of the targeted entity. */
  targetId: string;
  /** Short human-readable label for display ("iPhone 15 Pro", "John Doe"). */
  targetLabel?: string;
  /** Free-text note (rejection reason, edit summary, etc.). */
  note?: string;
}

/**
 * Record an audit entry to the audit_logs table.
 * Returns the entry synchronously (we construct a synthetic entry since
 * fire-and-forget DB inserts don't return immediately).
 */
export function logAudit(params: AuditLogParams): AuditLogEntry {
  const now = new Date();
  const id = `aud-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const entry: AuditLogEntry = {
    id,
    action: params.action,
    actorId: params.actorId,
    actorName: params.actorName,
    targetType: params.targetType,
    targetId: params.targetId,
    targetLabel: params.targetLabel,
    note: params.note,
    createdAt: now.toISOString(),
  };

  // Fire-and-forget DB insert — does not block the caller
  void db
    .insert(auditLogs)
    .values({
      id,
      action: params.action,
      actorId: params.actorId,
      actorName: params.actorName,
      targetType: params.targetType,
      targetId: params.targetId,
      targetLabel: params.targetLabel ?? null,
      note: params.note ?? null,
      createdAt: now,
    })
    .catch(() => {
      console.error(`[auditLogger] Failed to record audit: ${params.action}`);
    });

  return entry;
}

/* -------------------------------------------------------------------------- */
/* Moderation events (per-ad timeline)                                        */
/* -------------------------------------------------------------------------- */

interface ModerationEventParams {
  adId: string;
  actorId: string;
  actorName: string;
  action: ModerationAction;
  note?: string;
}

/**
 * Record a moderation event on an ad's timeline.
 * Fire-and-forget: does not block the calling operation.
 */
export function logModerationEvent(params: ModerationEventParams): void {
  const now = new Date();
  const id = `mod-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Fire-and-forget — don't await to avoid blocking the caller
  void db
    .insert(moderationEvents)
    .values({
      id,
      adId: params.adId,
      action: params.action,
      actorId: params.actorId,
      actorName: params.actorName,
      note: params.note ?? null,
      createdAt: now,
    })
    .catch(() => {
      console.error(`[auditLogger] Failed to record moderation event: ${params.action} on ${params.adId}`);
    });
}

/* -------------------------------------------------------------------------- */
/* Convenience loggers — one per action type                                  */
/* -------------------------------------------------------------------------- */

/** Log an ad being approved. */
export function logAdApproved(
  adId: string,
  adTitle: string,
  actorId: string,
  actorName: string,
  note?: string,
): void {
  logAudit({ actorId, actorName, action: "approved", targetType: "ad", targetId: adId, targetLabel: adTitle, note });
  logModerationEvent({ adId, actorId, actorName, action: "approved", note });
}

/** Log an ad being rejected. */
export function logAdRejected(
  adId: string,
  adTitle: string,
  actorId: string,
  actorName: string,
  note?: string,
): void {
  logAudit({ actorId, actorName, action: "rejected", targetType: "ad", targetId: adId, targetLabel: adTitle, note });
  logModerationEvent({ adId, actorId, actorName, action: "rejected", note });
}

/** Log an ad being hidden. */
export function logAdHidden(
  adId: string,
  adTitle: string,
  actorId: string,
  actorName: string,
  note?: string,
): void {
  logAudit({ actorId, actorName, action: "hidden", targetType: "ad", targetId: adId, targetLabel: adTitle, note });
  logModerationEvent({ adId, actorId, actorName, action: "hidden", note });
}

/** Log an ad being unhidden. */
export function logAdUnhidden(
  adId: string,
  adTitle: string,
  actorId: string,
  actorName: string,
  note?: string,
): void {
  logAudit({ actorId, actorName, action: "unhidden", targetType: "ad", targetId: adId, targetLabel: adTitle, note });
  logModerationEvent({ adId, actorId, actorName, action: "unhidden", note });
}

/** Log an ad being deleted. */
export function logAdDeleted(
  adId: string,
  adTitle: string,
  actorId: string,
  actorName: string,
  note?: string,
): void {
  logAudit({ actorId, actorName, action: "deleted", targetType: "ad", targetId: adId, targetLabel: adTitle, note });
  logModerationEvent({ adId, actorId, actorName, action: "deleted", note });
}

/** Log an ad being created. */
export function logAdCreated(
  adId: string,
  adTitle: string,
  actorId: string,
  actorName: string,
): void {
  logAudit({ actorId, actorName, action: "created", targetType: "ad", targetId: adId, targetLabel: adTitle });
  logModerationEvent({ adId, actorId, actorName, action: "created" });
}

/** Log an ad being submitted for review. */
export function logAdSubmitted(
  adId: string,
  adTitle: string,
  actorId: string,
  actorName: string,
): void {
  logAudit({ actorId, actorName, action: "submitted", targetType: "ad", targetId: adId, targetLabel: adTitle });
  logModerationEvent({ adId, actorId, actorName, action: "submitted" });
}

/** Log an ad being edited. */
export function logAdEdited(
  adId: string,
  adTitle: string,
  actorId: string,
  actorName: string,
  note?: string,
): void {
  logAudit({ actorId, actorName, action: "edited", targetType: "ad", targetId: adId, targetLabel: adTitle, note });
  logModerationEvent({ adId, actorId, actorName, action: "edited", note });
}

/** Log an ad being pinned. */
export function logAdPinned(
  adId: string,
  adTitle: string,
  actorId: string,
  actorName: string,
  note?: string,
): void {
  logAudit({ actorId, actorName, action: "pinned", targetType: "ad", targetId: adId, targetLabel: adTitle, note });
  logModerationEvent({ adId, actorId, actorName, action: "pinned", note });
}

/** Log an ad being unpinned. */
export function logAdUnpinned(
  adId: string,
  adTitle: string,
  actorId: string,
  actorName: string,
  note?: string,
): void {
  logAudit({ actorId, actorName, action: "unpinned", targetType: "ad", targetId: adId, targetLabel: adTitle, note });
  logModerationEvent({ adId, actorId, actorName, action: "unpinned", note });
}

/** Log an ad being featured. */
export function logAdFeatured(
  adId: string,
  adTitle: string,
  actorId: string,
  actorName: string,
  note?: string,
): void {
  logAudit({ actorId, actorName, action: "featured", targetType: "ad", targetId: adId, targetLabel: adTitle, note });
  logModerationEvent({ adId, actorId, actorName, action: "featured", note });
}

/** Log an ad being unfeatured. */
export function logAdUnfeatured(
  adId: string,
  adTitle: string,
  actorId: string,
  actorName: string,
  note?: string,
): void {
  logAudit({ actorId, actorName, action: "unfeatured", targetType: "ad", targetId: adId, targetLabel: adTitle, note });
  logModerationEvent({ adId, actorId, actorName, action: "unfeatured", note });
}

/** Log an ad being marked as sold. */
export function logAdSold(
  adId: string,
  adTitle: string,
  actorId: string,
  actorName: string,
): void {
  logAudit({ actorId, actorName, action: "sold", targetType: "ad", targetId: adId, targetLabel: adTitle });
  logModerationEvent({ adId, actorId, actorName, action: "sold" });
}

/** Log a user being suspended. */
export function logUserSuspended(
  userId: string,
  userName: string,
  actorId: string,
  actorName: string,
  note?: string,
): void {
  logAudit({ actorId, actorName, action: "user_suspended", targetType: "user", targetId: userId, targetLabel: userName, note });
}

/** Log a user being activated. */
export function logUserActivated(
  userId: string,
  userName: string,
  actorId: string,
  actorName: string,
  note?: string,
): void {
  logAudit({ actorId, actorName, action: "user_activated", targetType: "user", targetId: userId, targetLabel: userName, note });
}

/** Log a user being deleted. */
export function logUserDeleted(
  userId: string,
  userName: string,
  actorId: string,
  actorName: string,
  note?: string,
): void {
  logAudit({ actorId, actorName, action: "user_deleted", targetType: "user", targetId: userId, targetLabel: userName, note });
}

/** Log a report being ignored. */
export function logReportIgnored(
  reportId: string,
  adId: string,
  actorId: string,
  actorName: string,
  note?: string,
): void {
  logAudit({ actorId, actorName, action: "report_ignored", targetType: "report", targetId: reportId, note });
}

/** Log a report being resolved. */
export function logReportResolved(
  reportId: string,
  adId: string,
  actorId: string,
  actorName: string,
  note?: string,
): void {
  logAudit({ actorId, actorName, action: "report_resolved", targetType: "report", targetId: reportId, note });
}

/** Log settings being updated. */
export function logSettingsUpdated(
  actorId: string,
  actorName: string,
  note?: string,
): void {
  logAudit({ actorId, actorName, action: "edited", targetType: "ad", targetId: "settings", targetLabel: "Marketplace Settings", note });
}

/** Log a category being created. */
export function logCategoryCreated(
  categoryId: string,
  categoryLabel: string,
  actorId: string,
  actorName: string,
): void {
  logAudit({ actorId, actorName, action: "created", targetType: "category", targetId: categoryId, targetLabel: categoryLabel });
}

/** Log a category being updated. */
export function logCategoryUpdated(
  categoryId: string,
  categoryLabel: string,
  actorId: string,
  actorName: string,
  note?: string,
): void {
  logAudit({ actorId, actorName, action: "edited", targetType: "category", targetId: categoryId, targetLabel: categoryLabel, note });
}

/** Log a category being hidden. */
export function logCategoryHidden(
  categoryId: string,
  categoryLabel: string,
  actorId: string,
  actorName: string,
  note?: string,
): void {
  logAudit({ actorId, actorName, action: "hidden", targetType: "category", targetId: categoryId, targetLabel: categoryLabel, note });
}

/** Log a category being deleted. */
export function logCategoryDeleted(
  categoryId: string,
  categoryLabel: string,
  actorId: string,
  actorName: string,
  note?: string,
): void {
  logAudit({ actorId, actorName, action: "deleted", targetType: "category", targetId: categoryId, targetLabel: categoryLabel, note });
}

/* -------------------------------------------------------------------------- */
/*                                                     Security audit loggers */
/* -------------------------------------------------------------------------- */

/** Log a failed login attempt. */
export function logFailedLogin(
  ipAddress: string,
  reason: string,
): AuditLogEntry {
  const entry = logAudit({
    actorId: "anonymous",
    actorName: "anonymous",
    action: "login_failed",
    targetType: "system",
    targetId: "auth",
    targetLabel: "Authentication System",
    note: `${reason} (IP: ${ipAddress})`,
  });
  return entry;
}

/** Log a successful admin login. */
export function logAdminLogin(
  userId: string,
  userName: string,
  ipAddress: string,
): AuditLogEntry {
  const entry = logAudit({
    actorId: userId,
    actorName: userName,
    action: "admin_login",
    targetType: "system",
    targetId: "auth",
    targetLabel: "Authentication System",
    note: `IP: ${ipAddress}`,
  });
  return entry;
}

/** Log a username change. */
export function logUsernameChanged(
  userId: string,
  userName: string,
  oldUsername: string,
  newUsername: string,
): AuditLogEntry {
  const entry = logAudit({
    actorId: userId,
    actorName: userName,
    action: "username_changed",
    targetType: "user",
    targetId: userId,
    targetLabel: userName,
    note: `Changed from "${oldUsername}" to "${newUsername}"`,
  });
  return entry;
}

/** Log a profile edit. */
export function logProfileEdited(
  userId: string,
  userName: string,
  fieldsChanged: string[],
): AuditLogEntry {
  const entry = logAudit({
    actorId: userId,
    actorName: userName,
    action: "profile_edited",
    targetType: "user",
    targetId: userId,
    targetLabel: userName,
    note: `Changed fields: ${fieldsChanged.join(", ")}`,
  });
  return entry;
}

/** Log an unauthorized access attempt. */
export function logUnauthorizedAccess(
  userId: string,
  userName: string,
  resource: string,
  action: string,
): AuditLogEntry {
  const entry = logAudit({
    actorId: userId,
    actorName: userName,
    action: "unauthorized_access",
    targetType: "system",
    targetId: "security",
    targetLabel: "Security System",
    note: `Attempted ${action} on ${resource}`,
  });
  return entry;
}

/** Log a mass action (bulk approve, reject, delete). */
export function logMassAction(
  actorId: string,
  actorName: string,
  action: string,
  targetCount: number,
  targetIds: string[],
): AuditLogEntry {
  const entry = logAudit({
    actorId,
    actorName,
    action: action as ModerationAction,
    targetType: "ad",
    targetId: `bulk_${Date.now()}`,
    targetLabel: `${action} ${targetCount} items`,
    note: `Targets: ${targetIds.join(", ")}`,
  });
  return entry;
}

/* -------------------------------------------------------------------------- */
/*                                                Authentication audit loggers */
/* -------------------------------------------------------------------------- */

/** Log a credentials login attempt. */
export function logCredentialsLogin(
  userId: string,
  userName: string,
  ipAddress: string,
): AuditLogEntry {
  const entry = logAudit({
    actorId: userId,
    actorName: userName,
    action: "login" as ModerationAction,
    targetType: "system" as AuditTargetType,
    targetId: "auth",
    targetLabel: "Authentication System",
    note: `Method: Credentials, IP: ${ipAddress}`,
  });
  return entry;
}

/** Log a Google OAuth login. */
export function logGoogleLogin(
  userId: string,
  userName: string,
  ipAddress: string,
): AuditLogEntry {
  const entry = logAudit({
    actorId: userId,
    actorName: userName,
    action: "google_login" as ModerationAction,
    targetType: "system" as AuditTargetType,
    targetId: "auth",
    targetLabel: "Authentication System",
    note: `IP: ${ipAddress}`,
  });
  return entry;
}

/** Log a Google account linking. */
export function logGoogleLink(
  userId: string,
  userName: string,
  ipAddress: string,
): AuditLogEntry {
  const entry = logAudit({
    actorId: userId,
    actorName: userName,
    action: "google_linked" as ModerationAction,
    targetType: "system" as AuditTargetType,
    targetId: "auth",
    targetLabel: "Authentication System",
    note: `IP: ${ipAddress}`,
  });
  return entry;
}

/** Log an email verification. */
export function logEmailVerified(
  userId: string,
  userName: string,
  ipAddress?: string,
): AuditLogEntry {
  const entry = logAudit({
    actorId: userId,
    actorName: userName,
    action: "email_verified" as ModerationAction,
    targetType: "system" as AuditTargetType,
    targetId: "auth",
    targetLabel: "Authentication System",
    note: `IP: ${ipAddress || "unknown"}`,
  });
  return entry;
}

/** Log an OTP verification. */
export function logOtpVerified(
  userId: string,
  userName: string,
  purpose: "reset" | "verify" | "login",
  ipAddress?: string,
): AuditLogEntry {
  const entry = logAudit({
    actorId: userId,
    actorName: userName,
    action: "otp_verified" as ModerationAction,
    targetType: "system" as AuditTargetType,
    targetId: "auth",
    targetLabel: "Authentication System",
    note: `Purpose: ${purpose}, IP: ${ipAddress || "unknown"}`,
  });
  return entry;
}

/** Log a failed OTP attempt. */
export function logFailedOtp(
  userId: string,
  userName: string,
  purpose: "reset" | "verify" | "login",
  ipAddress?: string,
): AuditLogEntry {
  const entry = logAudit({
    actorId: userId,
    actorName: userName,
    action: "otp_failed" as ModerationAction,
    targetType: "system" as AuditTargetType,
    targetId: "auth",
    targetLabel: "Authentication System",
    note: `Purpose: ${purpose}, IP: ${ipAddress || "unknown"}`,
  });
  return entry;
}

/** Log a password reset. */
export function logPasswordReset(
  userId: string,
  userName: string,
  ipAddress?: string,
): AuditLogEntry {
  const entry = logAudit({
    actorId: userId,
    actorName: userName,
    action: "password_reset" as ModerationAction,
    targetType: "system" as AuditTargetType,
    targetId: "auth",
    targetLabel: "Authentication System",
    note: `IP: ${ipAddress || "unknown"}`,
  });
  return entry;
}

/** Log a new password creation (first password for Google user). */
export function logPasswordCreated(
  userId: string,
  userName: string,
  ipAddress?: string,
): AuditLogEntry {
  const entry = logAudit({
    actorId: userId,
    actorName: userName,
    action: "password_created" as ModerationAction,
    targetType: "system" as AuditTargetType,
    targetId: "auth",
    targetLabel: "Authentication System",
    note: `IP: ${ipAddress || "unknown"}`,
  });
  return entry;
}

/** Log a resend verification email. */
export function logResendVerification(
  userId: string,
  userName: string,
  ipAddress?: string,
): AuditLogEntry {
  const entry = logAudit({
    actorId: userId,
    actorName: userName,
    action: "resend_verification" as ModerationAction,
    targetType: "system" as AuditTargetType,
    targetId: "auth",
    targetLabel: "Authentication System",
    note: `IP: ${ipAddress || "unknown"}`,
  });
  return entry;
}

/** Log a resend OTP. */
export function logResendOtp(
  userId: string,
  userName: string,
  purpose: "reset" | "verify" | "login",
  ipAddress?: string,
): AuditLogEntry {
  const entry = logAudit({
    actorId: userId,
    actorName: userName,
    action: "resend_otp" as ModerationAction,
    targetType: "system" as AuditTargetType,
    targetId: "auth",
    targetLabel: "Authentication System",
    note: `Purpose: ${purpose}, IP: ${ipAddress || "unknown"}`,
  });
  return entry;
}

/** Log a user registration. */
export function logUserRegistration(
  userId: string,
  userName: string,
  email: string,
  ipAddress?: string,
): AuditLogEntry {
  const entry = logAudit({
    actorId: userId,
    actorName: userName,
    action: "register" as ModerationAction,
    targetType: "system" as AuditTargetType,
    targetId: "auth",
    targetLabel: "Authentication System",
    note: `Email: ${email}, IP: ${ipAddress || "unknown"}`,
  });
  return entry;
}

/** Log a user logout. */
export function logUserLogout(
  userId: string,
  userName: string,
  ipAddress?: string,
): AuditLogEntry {
  const entry = logAudit({
    actorId: userId,
    actorName: userName,
    action: "logout" as ModerationAction,
    targetType: "system" as AuditTargetType,
    targetId: "auth",
    targetLabel: "Authentication System",
    note: `IP: ${ipAddress || "unknown"}`,
  });
  return entry;
}
