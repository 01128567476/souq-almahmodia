/**
 * Drizzle ORM schema — main entry point.
 *
 * This file is referenced by drizzle.config.ts as the schema path.
 * It re-exports all enums, tables, and relations for clean imports.
 *
 * Import pattern:
 *   import { db } from "@/lib/db";
 *   import { users, products, adImages } from "@/drizzle/schema";
 *   import { usersRelations, productsRelations } from "@/drizzle/schema/relations";
 */

/* ======================================================================== */
/* ENUMS                                                                    */
/* ======================================================================== */

export {
  adStatusEnum,
  roleEnum,
  productConditionEnum,
  reportSeverityEnum,
  reportStatusEnum,
  reportReasonEnum,
  moderationActionEnum,
  reactionTypeEnum,
  auditTargetTypeEnum,
  notificationTypeEnum,
  commentStatusEnum,
  approvalModeEnum,
  enums,
} from "./enums";

export type {
  AdStatusValue,
  RoleValue,
  ProductConditionValue,
  ReportSeverityValue,
  ReportStatusValue,
  ReportReasonValue,
  ModerationActionValue,
  ReactionTypeValue,
  AuditTargetTypeValue,
  NotificationTypeValue,
  CommentStatusValue,
  ApprovalModeValue,
  AllEnums,
} from "./enums";

/* ======================================================================== */
/* TABLES                                                                   */
/* ======================================================================== */

export {
  users,
  categories,
  products,
  adImages,
  comments,
  reactions,
  favorites,
  reports,
  moderationEvents,
  auditLogs,
  notifications,
  settings,
  tables,
} from "./tables";

export {
  accounts,
  passwordResetTokens,
} from "./schemas-audit";

export type { AllTables } from "./tables";

/* ======================================================================== */
/* RELATIONS                                                                */
/* ======================================================================== */

export {
  usersRelations,
  categoriesRelations,
  productsRelations,
  adImagesRelations,
  commentsRelations,
  reactionsRelations,
  favoritesRelations,
  reportsRelations,
  moderationEventsRelations,
  auditLogsRelations,
  notificationsRelations,
  dbRelations,
} from "./relations";

export type { AllRelations } from "./relations";