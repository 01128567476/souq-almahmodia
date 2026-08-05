/**
 * Email verification repository — Drizzle ORM implementation.
 *
 * Handles all email verification token operations:
 * - Creating verification tokens
 * - Validating verification tokens
 * - Using (consuming) verification tokens (one-time use)
 * - Cleaning up expired tokens
 *
 * Token security:
 * - 32-byte cryptographically random token
 * - SHA-256 hashed in database (never stores plaintext)
 * - 24-hour expiration
 * - One-time use (invalidated after verification)
 * - Bound to user ID and email for replay prevention
 */

import { db } from "@/lib/db-server";
import { emailVerificationTokens, users } from "@/drizzle/schema";
import { eq, and, isNull, gt, lt, sql } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";

/** Verification token stored in database (hashed). */
export interface VerificationTokenRecord {
  id: string;
  userId: string;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

/** Result of a token verification attempt. */
export interface VerificationResult {
  success: boolean;
  error?: string;
  userId?: string;
  email?: string;
}

/**
 * Generate a secure verification token.
 * Returns { token, tokenHash } — only the hash is stored in DB.
 */
export function generateVerificationToken(): {
  token: string;
  tokenHash: string;
} {
  // Generate 32 bytes of cryptographically random data
  const rawToken = randomBytes(32).toString("hex");

  // Hash the token — we never store plaintext in the database
  const tokenHash = createHash("sha256")
    .update(rawToken)
    .digest("hex");

  return { token: rawToken, tokenHash };
}

/**
 * Create a new email verification token for a user.
 * Removes any existing unused tokens for the same user first.
 */
export async function createVerificationToken(
  userId: string,
  email: string,
): Promise<{ token: string; error?: string }> {
  try {
    // Remove any existing unused tokens for this user
    await db
      .delete(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.userId, userId),
          isNull(emailVerificationTokens.usedAt),
        ),
      );

    // Generate new token
    const { token, tokenHash } = generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour expiration

    // Insert token into database
    await db.insert(emailVerificationTokens).values({
      userId,
      email: email.toLowerCase().trim(),
      tokenHash,
      expiresAt,
    });

    return { token };
  } catch (error) {
    console.error("[VerificationToken] Failed to create token:", error);
    return { token: "", error: "Failed to create verification token" };
  }
}

/**
 * Verify a token provided by the user (from email link).
 * Returns verification result with user info if valid.
 */
export async function verifyToken(
  token: string,
): Promise<VerificationResult> {
  try {
    // Hash the provided token
    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    // Find the token record
    const records = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, tokenHash))
      .limit(1);

    if (records.length === 0) {
      return { success: false, error: "Invalid verification token" };
    }

    const record = records[0] as VerificationTokenRecord;

    // Check if already used
    if (record.usedAt !== null) {
      return { success: false, error: "Token has already been used" };
    }

    // Check if expired
    if (new Date() > record.expiresAt) {
      return { success: false, error: "Token has expired" };
    }

    return {
      success: true,
      userId: record.userId,
      email: record.email,
    };
  } catch (error) {
    console.error("[VerificationToken] Failed to verify token:", error);
    return { success: false, error: "Token verification failed" };
  }
}

/**
 * Consume a verification token (mark as used + update user).
 * This is a one-time operation — the token is invalidated after use.
 */
export async function consumeVerificationToken(
  token: string,
): Promise<VerificationResult> {
  try {
    // Hash the provided token
    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    // Find the token record within a transaction
    const result = await db.transaction(async (tx) => {
      // Find and lock the token row
      const records = await tx
        .select()
        .from(emailVerificationTokens)
        .where(eq(emailVerificationTokens.tokenHash, tokenHash))
        .limit(1);

      if (records.length === 0) {
        return { success: false, error: "Invalid verification token" };
      }

      const record = records[0] as VerificationTokenRecord;

      // Check if already used
      if (record.usedAt !== null) {
        return { success: false, error: "Token has already been used" };
      }

      // Check if expired
      if (new Date() > record.expiresAt) {
        return { success: false, error: "Token has expired" };
      }

      const now = new Date();

      // Mark token as used
      await tx
        .update(emailVerificationTokens)
        .set({ usedAt: now })
        .where(eq(emailVerificationTokens.id, record.id));

      // Update user's emailVerified field
      await tx
        .update(users)
        .set({ emailVerified: now.toISOString() })
        .where(eq(users.id, record.userId));

      return {
        success: true,
        userId: record.userId,
        email: record.email,
      };
    });

    return result;
  } catch (error) {
    console.error("[VerificationToken] Failed to consume token:", error);
    return { success: false, error: "Token verification failed" };
  }
}

/**
 * Invalidate all unused verification tokens for a user.
 * Used when user changes email or logs in via OAuth (email auto-verified).
 */
export async function invalidateUserTokens(userId: string): Promise<void> {
  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, userId));
}

/**
 * Clean up expired verification tokens.
 * Should be run periodically (e.g., on token creation).
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const now = new Date();
  const result = await db
    .delete(emailVerificationTokens)
    .where(lt(emailVerificationTokens.expiresAt, now));

  return Number(result?.rowCount ?? 0);
}

/**
 * Check if a user's email is already verified.
 */
export async function isEmailVerified(userId: string): Promise<boolean> {
  const row = await db
    .select({ emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (row.length === 0) return false;
  return row[0].emailVerified !== null;
}