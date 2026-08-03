/**
 * Password utilities — hashing and verification.
 *
 * Uses Node.js built-in crypto.pbkdf2sync for bcrypt-equivalent
 * password hashing without external dependencies.
 *
 * When Auth.js lands it will bring its own password helpers,
 * but the interface here (hash + verify) stays the same so
 * swapping is a single-line change.
 */

import { randomBytes, pbkdf2Sync, timingSafeEqual } from "crypto";

const SALT_LENGTH = 32;       // bytes
const HASH_LENGTH = 64;       // bytes (SHA-512)
const ITERATIONS = 100_000;
const DIGEST = "sha512";

/** Result of hashing a password. */
export interface HashedPassword {
  /** Salt (hex). */
  salt: string;
  /** Hash (hex). */
  hash: string;
}

/**
 * Hash a plain-text password.
 * Returns { salt, hash } as hex strings.
 */
export function hashPassword(password: string): HashedPassword {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, HASH_LENGTH, DIGEST).toString("hex");
  return { salt, hash };
}

/**
 * Verify a plain-text password against a stored { salt, hash }.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyPassword(
  password: string,
  salt: string,
  hash: string,
): boolean {
  const computed = pbkdf2Sync(password, salt, ITERATIONS, HASH_LENGTH, DIGEST).toString("hex");
  return timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
}

/**
 * Check password strength requirements.
 * Returns null if valid, or an error message key.
 */
export function validatePasswordStrength(password: string): string | null {
  if (!password) return "requiredField";
  if (password.length < 8) return "passwordMinLength";
  if (!/[A-Z]/.test(password)) return "passwordUppercase";
  if (!/[a-z]/.test(password)) return "passwordLowercase";
  if (!/[0-9]/.test(password)) return "passwordNumber";
  return null;
}