/**
 * Auth service — reads from PostgreSQL via userRepository.
 *
 * This service is used by Server Components and API routes.
 * It provides the single source of truth for user data lookups
 * based on session validation.
 *
 * No demo users. No mock data. No compatibility hacks.
 * Session management uses JWT stored in HTTP-only cookies (Auth.js compatible).
 */

import type { User, Role } from "@/types";

/**
 * Get user by ID with extended username fields.
 * Returns null if not found in DB.
 *
 * SERVER-ONLY: This function imports pg-driven userRepository.
 * Do NOT call from client components. Use API routes instead.
 */
export async function getUserProfile(userId: string): Promise<User | null> {
  const { userRepository } = await import("@/services/repositories/userRepository");
  const row = await userRepository.getFullProfile(userId);
  if (!row) return null;

  return mapDbUserToProfile(row);
}

/**
 * Get user by username (case-insensitive).
 * Returns null if not found.
 *
 * SERVER-ONLY: Do NOT call from client components.
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  const { userRepository } = await import("@/services/repositories/userRepository");
  const row = await userRepository.getByUsername(username);
  if (!row) return null;

  return mapDbUserToProfile(row);
}

/**
 * Get all users with username fields.
 * Used by global search and username availability checking.
 *
 * SERVER-ONLY: Do NOT call from client components.
 */
export async function getAllUserProfiles(): Promise<User[]> {
  const { userRepository } = await import("@/services/repositories/userRepository");
  const rows = await userRepository.getAllWithUsername();
  return rows.map((row) => mapDbUserToProfile(row));
}

/**
 * Check if a user has a password set.
 * Returns true if the user can authenticate via email/password.
 */
export async function userHasPassword(userId: string): Promise<boolean> {
  const { userRepository } = await import("@/services/repositories/userRepository");
  const hasPassword = await userRepository.hasPassword(userId);
  return hasPassword;
}

/**
 * Get user by ID with basic fields (name, email, role, avatar).
 * Used by session validation and auth context.
 * Returns null if not found.
 */
export async function getBasicUser(userId: string): Promise<{
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
} | null> {
  const profile = await getUserProfile(userId);
  if (!profile) return null;

  return {
    id: profile.id,
    name: profile.name || profile.displayName,
    email: profile.email,
    role: profile.role,
    avatar: profile.avatar || undefined,
  };
}

/**
 * Convert a date-like value to ISO string. Handles Date, ISO string, null/undefined.
 */
function toIsoString(val: Date | string | null | undefined): string | null {
  if (val == null) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") return val;
  return String(val);
}

/**
 * Map a DB user row to the User type.
 * PostgreSQL may return dates as Date objects OR ISO strings depending on driver config.
 */
function mapDbUserToProfile(row: {
  id: string;
  displayName: string;
  username: string;
  usernameLower: string;
  usernameLastChangedAt: Date | string | null;
  joinedAt: Date | string;
  avatar: string | null;
  googleId: string | null;
  email: string;
  role: string;
  phone: string | null;
}): User {
  return {
    id: row.id,
    displayName: row.displayName,
    username: row.username,
    usernameLower: row.usernameLower,
    usernameLastChangedAt: toIsoString(row.usernameLastChangedAt),
    joinedAt: toIsoString(row.joinedAt) ?? new Date().toISOString(),
    avatar: row.avatar ?? "",
    email: row.email,
    role: row.role as User["role"],
    googleId: row.googleId ?? "",
    name: row.displayName,
    phone: row.phone ?? undefined,
  };
}
