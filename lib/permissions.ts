/**
 * Centralized authorization helpers.
 *
 * Single source of truth for role-based access control.
 * Every endpoint must use these functions instead of inline role checks.
 *
 * Production-only. No mock data. No temporary code.
 */

import type { Role } from "@/types";

/**
 * Minimum role levels for comparison.
 */
const ROLE_LEVEL: Record<Role, number> = {
  guest: 0,
  user: 1,
  admin: 2,
};

/**
 * Check if a role meets or exceeds the required minimum role.
 */
export function hasRole(
  userRole: Role | null | undefined,
  requiredRole: Role,
): boolean {
  return (ROLE_LEVEL[userRole ?? "guest"] ?? 0) >= ROLE_LEVEL[requiredRole];
}

/**
 * Check if the current user is an admin.
 */
export function isAdmin(role: Role | null | undefined): boolean {
  return role === "admin";
}

/**
 * Check if the current user is a normal user (not guest, not admin).
 */
export function isNormalUser(role: Role | null | undefined): boolean {
  return role === "user";
}

/**
 * Whitelist of fields a normal user may edit on their own profile.
 * These are the ONLY fields that PATCH /api/users/[id] accepts for non-admin users.
 */
export const USER_EDITABLE_FIELDS: ReadonlySet<string> = new Set([
  "displayName",
  "username",
  "avatar",
  "phone",
  "bio",
  "language",
  "theme",
]);

/**
 * Fields that are NEVER editable by normal users, even on their own profile.
 */
export const USER_PROTECTED_FIELDS: ReadonlySet<string> = new Set([
  "role",
  "permissions",
  "passwordHash",
  "passwordSalt",
  "hasPassword",
  "emailVerified",
  "googleId",
  "email",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

/**
 * List of actions that require admin role.
 */
export const ADMIN_ACTIONS: ReadonlySet<string> = new Set([
  "approve",
  "reject",
  "hide",
  "unhide",
  "pin",
  "unpin",
  "feature",
  "unfeature",
  "delete_user",
  "suspend_user",
  "activate_user",
  "manage_categories",
  "view_audit_logs",
  "view_reports",
  "manage_settings",
  "resolve_reports",
]);