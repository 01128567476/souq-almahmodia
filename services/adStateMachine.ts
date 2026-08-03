/**
 * Advertisement state machine — enforces legal status transitions.
 *
 * No status change is allowed outside this transition table.
 * All transitions are validated BEFORE any database mutation.
 */

import type { AdStatus } from "@/types";

/* -------------------------------------------------------------------------- */
/* Transition table                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Legal transitions: sourceStatus -> Set of allowed target statuses.
 *
 * Rules:
 * - "pending"     → can be approved, rejected, hidden, deleted
 * - "approved"    → can be hidden, sold, expired, deleted, unhidden (no-op)
 * - "rejected"    → can be hidden, deleted, submitted (re-submit)
 * - "hidden"      → can be approved, unhidden, deleted
 * - "expired"     → can be renewed (→ approved), deleted
 * - "sold"        → can be deleted, unhidden (restored)
 * - "deleted"     → terminal (no transitions allowed)
 */
const LEGAL_TRANSITIONS: Record<AdStatus, Set<AdStatus>> = {
  pending:     new Set(["approved", "rejected", "hidden", "deleted"]),
  approved:    new Set(["hidden", "sold", "deleted"]),
  rejected:    new Set(["hidden", "deleted"]),
  hidden:      new Set(["approved", "deleted"]),
  expired:     new Set(["deleted"]),
  sold:        new Set(["deleted"]),
  deleted:     new Set(), // terminal — no transitions allowed
};

/* -------------------------------------------------------------------------- */
/* Transition error types                                                     */
/* -------------------------------------------------------------------------- */

export interface TransitionError {
  code: "INVALID_TRANSITION";
  message: string;
  currentStatus: AdStatus;
  attemptedStatus: AdStatus;
}

/* -------------------------------------------------------------------------- */
/* State machine engine                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Validate a status transition.
 * Throws TransitionError if the transition is illegal.
 */
export function validateTransition(
  currentStatus: AdStatus,
  targetStatus: AdStatus,
): void {
  const allowed = LEGAL_TRANSITIONS[currentStatus];

  if (!allowed) {
    throw createTransitionError(currentStatus, targetStatus);
  }

  if (!allowed.has(targetStatus)) {
    throw createTransitionError(currentStatus, targetStatus);
  }
}

/**
 * Execute a status transition with validation.
 * Returns the new status or throws on invalid transition.
 */
export function applyTransition(
  currentStatus: AdStatus,
  targetStatus: AdStatus,
): AdStatus {
  validateTransition(currentStatus, targetStatus);
  return targetStatus;
}

/**
 * Get all legally allowed transitions for a given status.
 * Useful for UI to show available actions.
 */
export function getAvailableTransitions(status: AdStatus): AdStatus[] {
  return Array.from(LEGAL_TRANSITIONS[status]);
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function createTransitionError(
  current: AdStatus,
  target: AdStatus,
): TransitionError {
  return {
    code: "INVALID_TRANSITION",
    message: `Cannot transition ad from "${current}" to "${target}"`,
    currentStatus: current,
    attemptedStatus: target,
  };
}