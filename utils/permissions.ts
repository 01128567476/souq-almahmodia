import type { Comment, User } from "@/types";
import { hasAtLeast } from "@/constants/roles";

/**
 * Reusable authorization helper for comment deletion.
 *
 * The rules (applied identically on the client and the server):
 *
 * 1. Admins can delete ANY comment on ANY advertisement.
 * 2. The advertisement's owner can delete ANY comment posted on their own ad,
 *    regardless of who wrote it.
 * 3. The comment's author can delete ONLY their own comment.
 * 4. Everyone else is forbidden.
 *
 * Keeping this single source of truth lets the UI hide the Delete action for
 * users who would be rejected by the server anyway — it never relies on hiding
 * alone; the server re-validates with the same function before deleting.
 *
 * @param currentUser the signed-in viewer (null when anonymous)
 * @param comment     the comment being targeted
 * @param advertisement the advertisement the comment belongs to (only its
 *                     `ownerId` is required; pass the full `Product` for
 *                     convenience or a `{ ownerId }` partial)
 */
export function canDeleteComment(
  currentUser: User | null,
  comment: Comment,
  advertisement: { ownerId?: string } | null | undefined,
): boolean {
  if (!currentUser) return false;

  // Rule 1 — admins can delete anything.
  if (hasAtLeast(currentUser.role, "admin")) return true;

  // The comment's own author may delete it (rule 3) and is also implicitly
  // allowed by the ad-owner check below, but authorship stands alone so it
  // works even when the ad record isn't available.
  if (comment.viewerIsAuthor || comment.author.id === currentUser.id) return true;

  // Rule 2 — the ad's owner may delete any comment on their ad.
  if (advertisement?.ownerId && advertisement.ownerId === currentUser.id) return true;

  // Rule 4 — everyone else is forbidden.
  return false;
}

/**
 * Server-side variant used inside the engagement service / API layer.
 *
 * It mirrors `canDeleteComment` but works on the raw, denormalized values the
 * store holds (comment author id + ad owner id + viewer role), so it does not
 * depend on the serialized `Comment.viewerIsAuthor` flag the UI relies on.
 *
 * Returns `true` when deletion is allowed, otherwise throws a `ForbiddenError`
 * which API routes translate into a 403 response — never swallow it silently.
 */
export class ForbiddenError extends Error {
  constructor(message = "You are not allowed to delete this comment") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export interface DeletePermissionInput {
  viewerId: string | null;
  viewerRole: User["role"] | null;
  commentAuthorId: string;
  adOwnerId?: string;
}

/**
 * Throws `ForbiddenError` unless the viewer is permitted to delete the comment.
 * Throws a plain `Error` when there is no viewer at all (treated as 401 by the
 * caller) so the two cases can be distinguished.
 */
export function assertCanDeleteComment(input: DeletePermissionInput): void {
  const { viewerId, viewerRole, commentAuthorId, adOwnerId } = input;

  if (!viewerId || !viewerRole) {
    throw new Error("Authentication required");
  }

  // Admin: any comment on any ad.
  if (hasAtLeast(viewerRole, "admin")) return;

  // Comment author: own comment.
  if (commentAuthorId === viewerId) return;

  // Ad owner: any comment on their own ad.
  if (adOwnerId && adOwnerId === viewerId) return;

  throw new ForbiddenError();
}