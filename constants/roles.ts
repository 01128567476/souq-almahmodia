import type { Role } from "@/types";

export const ROLES: Role[] = ["guest", "user", "admin"];

/** Role hierarchy — higher number grants access to everything at or below it. */
export const ROLE_LEVEL: Record<Role, number> = {
  guest: 0,
  user: 1,
  admin: 2,
};

// Session cookie name. Bumped from the legacy "sam_role" so any stale cookie
// left over from earlier builds (e.g. a lingering admin session on first open)
// is simply ignored instead of silently signing users in as admin.
export const SESSION_COOKIE = "sam_session";

export function hasAtLeast(role: Role, required: Role): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[required];
}
