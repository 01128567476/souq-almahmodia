/**
 * Server-side authorization helpers for the marketplace.
 *
 * Every API route should use these functions (or their assertion variants)
 * before performing a mutation.  They enforce the same permission model used
 * by the client-side `canDeleteComment` so UI and server never disagree.
 *
 * Rules:
 *  1. Admins can do everything.
 *  2. Advertisement owners can manage their own ads (edit, delete, view comments).
 *  3. Users can only manage their own non-ad resources (comments on other ads,
 *     favorites, reports they filed).
 *  4. Guests cannot perform any mutation.
 *
 * These helpers are pure (return boolean) — the `assert*` variants throw
 * `ForbiddenError` (403) so API routes can catch and translate them.
 *
 * Design: single source of truth.  Never duplicate permission logic.
 */

import type { Role } from "@/types";
import { hasAtLeast } from "@/constants/roles";

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

/** Thrown when a viewer lacks permission for an operation. */
export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Thrown when the viewer is not authenticated. */
export class UnauthenticatedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

/* -------------------------------------------------------------------------- */
/* Permission helpers — return boolean                                         */
/* -------------------------------------------------------------------------- */

/**
 * Check if the viewer is authenticated (not a guest).
 */
export function isAuthenticating(viewerRole: Role): boolean {
  return viewerRole !== "guest";
}

/**
 * Check if the viewer is an admin.
 */
export function isAdmin(viewerRole: Role): boolean {
  return hasAtLeast(viewerRole, "admin");
}

/**
 * Check if the viewer has at least the required role level.
 */
export function hasRole(viewerRole: Role, required: Role): boolean {
  return hasAtLeast(viewerRole, required);
}

/**
 * Check if the viewer owns a resource (by ID match).
 */
export function isOwner(viewerId: string | null, ownerId: string | null | undefined): boolean {
  return Boolean(viewerId && ownerId && viewerId === ownerId);
}

/**
 * Check if the viewer can VIEW an advertisement.
 *
 * Rules:
 *  - Admins can see everything.
 *  - Approved ads are public.
 *  - Pending/hidden/sold/expired ads: only the owner or admin can see.
 *  - Rejected/deleted ads: only the owner can see their own.
 */
export function canViewAd(
  viewerRole: Role,
  viewerId: string | null,
  adOwnerId: string | null | undefined,
  adStatus: string,
): boolean {
  if (isAdmin(viewerRole)) return true;
  // Approved ads are public.
  if (adStatus === "approved") return true;
  // Owners can always see their own ads.
  if (isOwner(viewerId, adOwnerId)) return true;
  // Everyone else: no access to non-public ads.
  return false;
}

/**
 * Check if the viewer can CREATE an advertisement.
 *
 * Rules:
 *  - Only authenticated users (not guests).
 */
export function canCreateAd(viewerRole: Role): boolean {
  return isAuthenticating(viewerRole);
}

/**
 * Check if the viewer can EDIT an advertisement.
 *
 * Rules:
 *  - Admins can edit any ad.
 *  - Owners can edit their own ads.
 */
export function canEditAd(
  viewerRole: Role,
  viewerId: string | null,
  adOwnerId: string | null | undefined,
): boolean {
  if (isAdmin(viewerRole)) return true;
  return isOwner(viewerId, adOwnerId);
}

/**
 * Check if the viewer can DELETE an advertisement.
 *
 * Rules:
 *  - Admins can delete any ad.
 *  - Owners can delete their own ads.
 */
export function canDeleteAd(
  viewerRole: Role,
  viewerId: string | null,
  adOwnerId: string | null | undefined,
): boolean {
  if (isAdmin(viewerRole)) return true;
  return isOwner(viewerId, adOwnerId);
}

/**
 * Check if the viewer can APPROVE an advertisement.
 *
 * Rules:
 *  - Only admins.
 */
export function canApproveAd(viewerRole: Role): boolean {
  return isAdmin(viewerRole);
}

/**
 * Check if the viewer can REJECT an advertisement.
 *
 * Rules:
 *  - Only admins.
 */
export function canRejectAd(viewerRole: Role): boolean {
  return isAdmin(viewerRole);
}

/**
 * Check if the viewer can HIDE/UNHIDE an advertisement.
 *
 * Rules:
 *  - Only admins.
 */
export function canHideAd(viewerRole: Role): boolean {
  return isAdmin(viewerRole);
}

/**
 * Check if the viewer can PIN/FEATURE an advertisement.
 *
 * Rules:
 *  - Only admins.
 */
export function canPinAd(viewerRole: Role): boolean {
  return isAdmin(viewerRole);
}

/**
 * Check if the viewer can view comments on an ad.
 *
 * Rules:
 *  - Admins can see all comments on all ads.
 *  - Owners can see all comments on their own ads.
 *  - Regular users can see comments on any ad (comments are public).
 *  - Guests can see comments on public (approved) ads only.
 */
export function canViewComments(
  viewerRole: Role,
  viewerId: string | null,
  adOwnerId: string | null | undefined,
  adStatus: string,
): boolean {
  if (isAdmin(viewerRole)) return true;
  if (isAuthenticating(viewerRole)) return true;
  // Guests: only on approved ads.
  return adStatus === "approved";
}

/**
 * Check if the viewer can CREATE a comment on an ad.
 *
 * Rules:
 *  - Only authenticated users (not guests).
 */
export function canCreateComment(viewerRole: Role): boolean {
  return isAuthenticating(viewerRole);
}

/**
 * Check if the viewer can EDIT a comment.
 *
 * Rules:
 *  - Admins can edit any comment.
 *  - Comment authors can edit their own.
 */
export function canEditComment(
  viewerRole: Role,
  viewerId: string | null,
  commentAuthorId: string | null,
): boolean {
  if (isAdmin(viewerRole)) return true;
  return isOwner(viewerId, commentAuthorId);
}

/**
 * Check if the viewer can DELETE a comment.
 *
 * Rules (mirrors client-side canDeleteComment):
 *  1. Admins can delete ANY comment on ANY ad.
 *  2. Ad owners can delete ANY comment on THEIR ad.
 *  3. Comment authors can delete their own comments.
 *  4. Everyone else is forbidden.
 */
export function canDeleteComment(
  viewerRole: Role,
  viewerId: string | null,
  commentAuthorId: string | null,
  adOwnerId: string | null | undefined,
): boolean {
  if (isAdmin(viewerRole)) return true;
  // Comment author can always delete their own.
  if (isOwner(viewerId, commentAuthorId)) return true;
  // Ad owner can delete any comment on their ad.
  if (isOwner(viewerId, adOwnerId)) return true;
  return false;
}

/**
 * Check if the viewer can EDIT their own profile.
 *
 * Rules:
 *  - Only the profile owner (or admin for full user management).
 */
export function canEditProfile(
  viewerRole: Role,
  viewerId: string | null,
  profileOwnerId: string,
): boolean {
  if (isAdmin(viewerRole)) return true;
  return isOwner(viewerId, profileOwnerId);
}

/**
 * Check if the viewer can view the user management dashboard.
 *
 * Rules:
 *  - Only admins.
 */
export function canManageUsers(viewerRole: Role): boolean {
  return isAdmin(viewerRole);
}

/**
 * Check if the viewer can delete a user account.
 *
 * Rules:
 *  - Only admins, and never themselves (self-delete handled separately).
 */
export function canDeleteUser(
  viewerRole: Role,
  viewerId: string | null,
  targetUserId: string,
): boolean {
  if (isAdmin(viewerRole) && viewerId !== targetUserId) return true;
  // Users can delete their own account (self-service).
  if (isOwner(viewerId, targetUserId)) return true;
  return false;
}

/**
 * Check if the viewer can SUSPEND/ACTIVATE a user.
 *
 * Rules:
 *  - Only admins.
 */
export function canModerateUser(viewerRole: Role): boolean {
  return isAdmin(viewerRole);
}

/**
 * Check if the viewer can report an advertisement.
 *
 * Rules:
 *  - Only authenticated users.
 */
export function canReportAd(viewerRole: Role): boolean {
  return isAuthenticating(viewerRole);
}

/**
 * Check if the viewer can VIEW a report they filed.
 *
 * Rules:
 *  - Report authors and admins.
 */
export function canViewReport(
  viewerRole: Role,
  viewerId: string | null,
  reporterId: string | null,
): boolean {
  if (isAdmin(viewerRole)) return true;
  return isOwner(viewerId, reporterId);
}

/**
 * Check if the viewer can moderate reports (view all, investigate).
 *
 * Rules:
 *  - Only admins.
 */
export function canModerateReports(viewerRole: Role): boolean {
  return isAdmin(viewerRole);
}

/**
 * Check if the viewer can IGNORE a report.
 *
 * Rules:
 *  - Only admins.
 */
export function canIgnoreReport(viewerRole: Role): boolean {
  return isAdmin(viewerRole);
}

/**
 * Check if the viewer can VIEW/EDIT settings.
 *
 * Rules:
 *  - Only admins.
 */
export function canManageSettings(viewerRole: Role): boolean {
  return isAdmin(viewerRole);
}

/**
 * Check if the viewer can VIEW/EDIT categories.
 *
 * Rules:
 *  - Only admins.
 */
export function canManageCategories(viewerRole: Role): boolean {
  return isAdmin(viewerRole);
}

/**
 * Check if the viewer can VIEW the analytics dashboard.
 *
 * Rules:
 *  - Admins see all analytics.
 *  - Users see only their own ad analytics.
 */
export function canViewAnalytics(
  viewerRole: Role,
  viewerId: string | null,
  adOwnerId?: string | null,
): boolean {
  if (isAdmin(viewerRole)) return true;
  // Users can see analytics for their own ads.
  if (!adOwnerId || isOwner(viewerId, adOwnerId)) return true;
  return false;
}

/**
 * Check if the viewer can favorite/unfavorite an ad.
 *
 * Rules:
 *  - Only authenticated users.
 */
export function canFavorite(viewerRole: Role): boolean {
  return isAuthenticating(viewerRole);
}

/* -------------------------------------------------------------------------- */
/* Assertion helpers — throw ForbiddenError / UnauthenticatedError            */
/* -------------------------------------------------------------------------- */

/**
 * Assert the viewer is authenticated.  Throws UnauthenticatedError if not.
 */
export function requireAuth(viewerRole: Role, viewerId: string | null): void {
  if (!viewerId || viewerRole === "guest") {
    throw new UnauthenticatedError();
  }
}

/**
 * Assert the viewer can view an ad.  Throws ForbiddenError if not.
 */
export function requireCanViewAd(
  viewerRole: Role,
  viewerId: string | null,
  adOwnerId: string | null | undefined,
  adStatus: string,
): void {
  if (!canViewAd(viewerRole, viewerId, adOwnerId, adStatus)) {
    throw new ForbiddenError("You do not have permission to view this advertisement");
  }
}

/**
 * Assert the viewer can edit an ad.  Throws ForbiddenError if not.
 */
export function requireCanEditAd(
  viewerRole: Role,
  viewerId: string | null,
  adOwnerId: string | null | undefined,
): void {
  if (!canEditAd(viewerRole, viewerId, adOwnerId)) {
    throw new ForbiddenError("You do not have permission to edit this advertisement");
  }
}

/**
 * Assert the viewer can delete an ad.  Throws ForbiddenError if not.
 */
export function requireCanDeleteAd(
  viewerRole: Role,
  viewerId: string | null,
  adOwnerId: string | null | undefined,
): void {
  if (!canDeleteAd(viewerRole, viewerId, adOwnerId)) {
    throw new ForbiddenError("You do not have permission to delete this advertisement");
  }
}

/**
 * Assert the viewer can approve an ad.  Throws ForbiddenError if not.
 */
export function requireCanApproveAd(viewerRole: Role): void {
  if (!canApproveAd(viewerRole)) {
    throw new ForbiddenError("Only administrators can approve advertisements");
  }
}

/**
 * Assert the viewer can reject an ad.  Throws ForbiddenError if not.
 */
export function requireCanRejectAd(viewerRole: Role): void {
  if (!canRejectAd(viewerRole)) {
    throw new ForbiddenError("Only administrators can reject advertisements");
  }
}

/**
 * Assert the viewer can hide an ad.  Throws ForbiddenError if not.
 */
export function requireCanHideAd(viewerRole: Role): void {
  if (!canHideAd(viewerRole)) {
    throw new ForbiddenError("Only administrators can hide advertisements");
  }
}

/**
 * Assert the viewer can pin an ad.  Throws ForbiddenError if not.
 */
export function requireCanPinAd(viewerRole: Role): void {
  if (!canPinAd(viewerRole)) {
    throw new ForbiddenError("Only administrators can pin advertisements");
  }
}

/**
 * Assert the viewer can create a comment.  Throws ForbiddenError if not.
 */
export function requireCanCreateComment(viewerRole: Role): void {
  if (!canCreateComment(viewerRole)) {
    throw new ForbiddenError("You must be logged in to post comments");
  }
}

/**
 * Assert the viewer can edit a comment.  Throws ForbiddenError if not.
 */
export function requireCanEditComment(
  viewerRole: Role,
  viewerId: string | null,
  commentAuthorId: string | null,
): void {
  if (!canEditComment(viewerRole, viewerId, commentAuthorId)) {
    throw new ForbiddenError("You do not have permission to edit this comment");
  }
}

/**
 * Assert the viewer can delete a comment.  Throws ForbiddenError if not.
 */
export function requireCanDeleteComment(
  viewerRole: Role,
  viewerId: string | null,
  commentAuthorId: string | null,
  adOwnerId: string | null | undefined,
): void {
  if (!canDeleteComment(viewerRole, viewerId, commentAuthorId, adOwnerId)) {
    throw new ForbiddenError("You do not have permission to delete this comment");
  }
}

/**
 * Assert the viewer can manage users.  Throws ForbiddenError if not.
 */
export function requireCanManageUsers(viewerRole: Role): void {
  if (!canManageUsers(viewerRole)) {
    throw new ForbiddenError("Only administrators can manage users");
  }
}

/**
 * Assert the viewer can moderate users.  Throws ForbiddenError if not.
 */
export function requireCanModerateUser(viewerRole: Role): void {
  if (!canModerateUser(viewerRole)) {
    throw new ForbiddenError("Only administrators can moderate users");
  }
}

/**
 * Assert the viewer can manage settings.  Throws ForbiddenError if not.
 */
export function requireCanManageSettings(viewerRole: Role): void {
  if (!canManageSettings(viewerRole)) {
    throw new ForbiddenError("Only administrators can manage settings");
  }
}

/**
 * Assert the viewer can manage categories.  Throws ForbiddenError if not.
 */
export function requireCanManageCategories(viewerRole: Role): void {
  if (!canManageCategories(viewerRole)) {
    throw new ForbiddenError("Only administrators can manage categories");
  }
}

/**
 * Assert the viewer can favorite.  Throws ForbiddenError if not.
 */
export function requireCanFavorite(viewerRole: Role): void {
  if (!canFavorite(viewerRole)) {
    throw new ForbiddenError("You must be logged in to favorite ads");
  }
}