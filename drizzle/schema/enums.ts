/**
 * Drizzle enum types — exact mirror of TypeScript types used in the application.
 *
 * These enums must match types/index.ts exactly. Never diverge.
 */

import { pgEnum } from "drizzle-orm/pg-core";

/* ======================================================================== */
/* Ad Status — mirrors AdStatus in types/index.ts                           */
/* ======================================================================== */

export const adStatusEnum = pgEnum("ad_status", [
  "pending",
  "approved",
  "rejected",
  "hidden",
  "expired",
  "sold",
  "deleted",
]);

export type AdStatusValue = typeof adStatusEnum.enumValues;

/* ======================================================================== */
/* Role — mirrors Role in types/index.ts                                    */
/* ======================================================================== */

export const roleEnum = pgEnum("user_role", ["guest", "user", "admin"]);

export type RoleValue = typeof roleEnum.enumValues;

/* ======================================================================== */
/* Product Condition — mirrors ProductCondition in types/index.ts           */
/* ======================================================================== */

export const productConditionEnum = pgEnum("product_condition", [
  "new",
  "excellent",
  "good",
  "fair",
]);

export type ProductConditionValue = typeof productConditionEnum.enumValues;

/* ======================================================================== */
/* Report Severity — mirrors ReportSeverity in types/index.ts               */
/* ======================================================================== */

export const reportSeverityEnum = pgEnum("report_severity", [
  "low",
  "medium",
  "high",
]);

export type ReportSeverityValue = typeof reportSeverityEnum.enumValues;

/* ======================================================================== */
/* Report Status — mirrors ReportStatus in types/index.ts                   */
/* ======================================================================== */

export const reportStatusEnum = pgEnum("report_status", [
  "open",
  "investigating",
  "resolved",
]);

export type ReportStatusValue = typeof reportStatusEnum.enumValues;

/* ======================================================================== */
/* Report Reason — mirrors ReportReason in types/index.ts                   */
/* ======================================================================== */

export const reportReasonEnum = pgEnum("report_reason", [
  "spam",
  "prohibited",
  "counterfeit",
  "offensive",
  "misleading",
  "wrong_category",
  "other",
]);

export type ReportReasonValue = typeof reportReasonEnum.enumValues;

/* ======================================================================== */
/* Moderation Action — mirrors ModerationAction in types/index.ts           */
/* ======================================================================== */

export const moderationActionEnum = pgEnum("moderation_action", [
  // Ad lifecycle
  "created",
  "submitted",
  "edited",
  "approved",
  "rejected",
  "hidden",
  "unhidden",
  "deleted",
  "restored",
  "expired",
  "renewed",
  "sold",
  // Admin actions
  "pinned",
  "unpinned",
  "featured",
  "unfeatured",
  // User actions
  "user_suspended",
  "user_activated",
  "user_deleted",
  // Report actions
  "report_ignored",
  "report_resolved",
  // Security
  "login_failed",
  "admin_login",
  "username_changed",
  "profile_edited",
  "unauthorized_access",
]);

export type ModerationActionValue = typeof moderationActionEnum.enumValues;

/* ======================================================================== */
/* Reaction Type — mirrors ReactionType in types/index.ts                   */
/* ======================================================================== */

export const reactionTypeEnum = pgEnum("reaction_type", [
  "like",
  "love",
  "funny",
  "wow",
  "sad",
]);

export type ReactionTypeValue = typeof reactionTypeEnum.enumValues;

/* ======================================================================== */
/* Audit Target Type — mirrors AuditTargetType in types/index.ts            */
/* ======================================================================== */

export const auditTargetTypeEnum = pgEnum("audit_target_type", [
  "ad",
  "user",
  "report",
  "category",
  "system",
]);

export type AuditTargetTypeValue = typeof auditTargetTypeEnum.enumValues;

/* ======================================================================== */
/* Notification Type — mirrors AppNotification.type in types/index.ts       */
/* ======================================================================== */

export const notificationTypeEnum = pgEnum("notification_type", [
  "report",
  "system",
  "ad_approved",
  "ad_rejected",
  "ad_expired",
]);

export type NotificationTypeValue = typeof notificationTypeEnum.enumValues;

/* ======================================================================== */
/* Comment Status — mirrors StoredComment.status in types/index.ts          */
/* ======================================================================== */

export const commentStatusEnum = pgEnum("comment_status", [
  "visible",
  "deleted",
  "hidden",
]);

export type CommentStatusValue = typeof commentStatusEnum.enumValues;

/* ======================================================================== */
/* Approval Mode — mirrors MarketplaceSettings.approvalMode                  */
/* ======================================================================== */

export const approvalModeEnum = pgEnum("approval_mode", [
  "manual",
  "automatic",
]);

export type ApprovalModeValue = typeof approvalModeEnum.enumValues;

/* ======================================================================== */
/* Re-export all enums for imports in schema/index.ts                       */
/* ======================================================================== */

export const enums = {
  adStatus: adStatusEnum,
  role: roleEnum,
  productCondition: productConditionEnum,
  reportSeverity: reportSeverityEnum,
  reportStatus: reportStatusEnum,
  reportReason: reportReasonEnum,
  moderationAction: moderationActionEnum,
  reactionType: reactionTypeEnum,
  auditTargetType: auditTargetTypeEnum,
  notificationType: notificationTypeEnum,
  commentStatus: commentStatusEnum,
  approvalMode: approvalModeEnum,
};

export type AllEnums = typeof enums;