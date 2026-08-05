/**
 * OTP repository - Drizzle ORM implementation.
 *
 * Handles all OTP token operations:
 * - Generating and storing OTP tokens
 * - Validating OTP tokens
 * - One-time use (invalidated after use)
 * - Rate limiting via retry tracking
 *
 * Security specifications:
 * - 6-digit numeric OTP codes
 * - Cryptographically secure random generation
 * - SHA-256 hashed in database (never stores plaintext)
 * - 5-minute expiration
 * - One-time use
 * - Maximum 3 failed attempts per token
 */

import { db } from "@/lib/db-server";
import { otpTokens } from "@/drizzle/schema";
import { eq, and, isNull, gt, lt, or, isNotNull, count, sql } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";

/** OTP token stored in database (hashed). */
export interface OtpTokenRecord {
  id: string;
  userId: string;
  email: string;
  channel: string;
  code: string; // stores hashed OTP
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  failedAttempts: number;
  createdAt: Date;
}

/** Result of an OTP verification attempt. */
export interface OtpResult {
  success: boolean;
  error?: string;
  code?: string;
}

/** Maximum failed attempts before lockout. */
const MAX_ATTEMPTS = 3;

/** Rate limit window in minutes (for resend). */
const RATE_LIMIT_WINDOW_MINUTES = 15;

/** OTP expiration in minutes. */
const OTP_EXPIRATION_MINUTES = 5;

/**
 * Generate a cryptographically secure 6-digit numeric OTP code.
 * Returns plaintext code to the caller (for email only).
 */
export function generateOtpCode(): string {
  // Generate 4 bytes of cryptographically secure random data
  const bytes = randomBytes(4);
  // Convert to a number and take modulo 1000000 for 0-999999 range
  const num = bytes.readUInt32BE(0) % 1000000;
  // Return as 6-digit zero-padded string
  return num.toString().padStart(6, "0");
}

/**
 * Hash the OTP code for secure storage.
 * Uses SHA-256 hashing.
 */
function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * Create a new OTP code for a user.
 * - Implements rate limiting: max 5 new codes per 15 minutes
 * - Invalidates any existing unused tokens for this user+channel
 * - Stores ONLY the hashed code in the database
 *
 * Returns the plaintext code to the caller for email delivery.
 */
export async function createOtpToken(
  userId: string,
  email: string,
  channel: string = "email",
): Promise<OtpResult> {
  try {
    // Check rate limiting - count how many tokens created in the last 15 minutes
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - RATE_LIMIT_WINDOW_MINUTES);

    const recentCount = await db
      .select({ count: count() })
      .from(otpTokens)
      .where(
        and(
          eq(otpTokens.userId, userId),
          gt(otpTokens.createdAt, windowStart),
        ),
      )
      .limit(1);

    if (Number(recentCount[0]?.count ?? 0) >= 5) {
      return { success: false, error: "Too many OTP requests. Please wait 15 minutes." };
    }

    // Invalidate any existing unused tokens for this user+channel
    await db
      .delete(otpTokens)
      .where(
        and(
          eq(otpTokens.userId, userId),
          eq(otpTokens.channel, channel),
          isNull(otpTokens.usedAt),
        ),
      );

    // Generate new OTP code
    const code = generateOtpCode();
    const codeHash = hashCode(code);

    // Token expires in 5 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRATION_MINUTES);

    // Store ONLY the hashed token - never store plaintext in DB
    await db.insert(otpTokens).values({
      userId,
      email: email.toLowerCase().trim(),
      channel,
      code: codeHash, // Store hash in `code` field
      tokenHash: codeHash,
      expiresAt,
      failedAttempts: 0,
    });

    // Return plaintext code to caller (for email delivery only)
    return { success: true, code };
  } catch (error) {
    console.error("[OTP] Failed to create token:", error);
    return { success: false, error: "Failed to generate OTP code" };
  }
}

/**
 * Verify an OTP code provided by the user.
 *
 * Security:
 * - Hashes the provided code before lookup
 * - Checks expiration
 * - Tracks failed attempts (max 3)
 * - Does NOT reveal whether user exists (generic error)
 */
export async function verifyOtpCode(
  userId: string,
  code: string,
  channel: string = "email",
): Promise<OtpResult> {
  try {
    const codeHash = hashCode(code);

    // Find the token record - lookup by code hash
    const records = await db
      .select()
      .from(otpTokens)
      .where(
        and(
          eq(otpTokens.userId, userId),
          eq(otpTokens.channel, channel),
          eq(otpTokens.code, codeHash),
          isNull(otpTokens.usedAt),
        ),
      )
      .limit(1);

    if (records.length === 0) {
      // Record failed attempt for security tracking
      await recordFailedAttempt(userId, channel);
      return { success: false, error: "Invalid OTP code" };
    }

    const record = records[0] as OtpTokenRecord;

    // Check if expired
    if (new Date() > record.expiresAt) {
      return { success: false, error: "OTP code has expired" };
    }

    // Check max attempts exceeded
    if (record.failedAttempts >= MAX_ATTEMPTS) {
      return { success: false, error: "Too many failed attempts. Please request a new code." };
    }

    return { success: true, code };
  } catch (error) {
    console.error("[OTP] Failed to verify code:", error);
    return { success: false, error: "OTP verification failed" };
  }
}

/**
 * Consume an OTP code (mark as used).
 * This is a one-time operation - the code is invalidated after use.
 */
export async function consumeOtpToken(
  userId: string,
  code: string,
  channel: string = "email",
): Promise<OtpResult> {
  try {
    const codeHash = hashCode(code);

    const result = await db.transaction(async (tx) => {
      // Find the token row within transaction
      const records = await tx
        .select()
        .from(otpTokens)
        .where(
          and(
            eq(otpTokens.userId, userId),
            eq(otpTokens.channel, channel),
            eq(otpTokens.code, codeHash),
            isNull(otpTokens.usedAt),
          ),
        )
        .limit(1);

      if (records.length === 0) {
        return { success: false, error: "Invalid OTP code" };
      }

      const record = records[0] as OtpTokenRecord;

      // Check if expired
      if (new Date() > record.expiresAt) {
        return { success: false, error: "OTP code has expired" };
      }

      // Check max attempts exceeded
      if (record.failedAttempts >= MAX_ATTEMPTS) {
        return { success: false, error: "Too many failed attempts. Please request a new code." };
      }

      const now = new Date();

      // Mark token as used (one-time use)
      await tx
        .update(otpTokens)
        .set({ usedAt: now })
        .where(eq(otpTokens.id, record.id));

      return { success: true, code };
    });

    return result;
  } catch (error) {
    console.error("[OTP] Failed to consume token:", error);
    return { success: false, error: "OTP verification failed" };
  }
}

/**
 * Record a failed OTP attempt for rate limiting.
 */
async function recordFailedAttempt(userId: string, channel: string): Promise<void> {
  await db
    .update(otpTokens)
    .set({ failedAttempts: sql`${otpTokens.failedAttempts} + 1` })
    .where(
      and(
        eq(otpTokens.userId, userId),
        eq(otpTokens.channel, channel),
        isNull(otpTokens.usedAt),
      ),
    );
}

/**
 * Clean up expired and used OTP tokens.
 */
export async function cleanupExpiredOtpTokens(): Promise<number> {
  const now = new Date();
  const result = await db
    .delete(otpTokens)
    .where(
      or(
        lt(otpTokens.expiresAt, now), // Expired
        isNotNull(otpTokens.usedAt), // Used
      ),
    );

  return Number(result?.rowCount ?? 0);
}