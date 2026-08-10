/**
 * Validation architecture - prepared for Zod.
 *
 * This module provides reusable, type-safe validation functions.
 * When Zod is introduced, these functions can be replaced with schema parsing
 * without changing API route callers.
 *
 * Design principles:
 * - Never trust user input
 * - Return structured error objects
 * - Support both boolean and detailed error messages
 * - Prepare for Zod schema-based validation
 */

/* -------------------------------------------------------------------------- */
/* Result type for validation                                                  */
/* -------------------------------------------------------------------------- */

/** Result of a validation operation. */
export interface ValidationResult<T = string> {
  /** Whether the value passed validation. */
  success: boolean;
  /** The validated/sanitized value (on success). */
  data?: T;
  /** Error message (on failure). */
  error?: string;
}

/**
 * Create a successful validation result.
 */
export function valid<T>(data: T): ValidationResult<T> {
  return { success: true, data };
}

/**
 * Create a failed validation result.
 */
export function invalid<T>(error: string): ValidationResult<T> {
  return { success: false, error };
}

/* -------------------------------------------------------------------------- */
/* String validators                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Trim and validate a string is not empty.
 */
export function requireString(value: unknown, fieldName: string): ValidationResult<string> {
  if (typeof value !== "string") {
    return invalid<string>(`${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return invalid<string>(`${fieldName} is required`);
  }
  return valid<string>(trimmed);
}

/**
 * Validate string length with min/max bounds.
 */
export function minLength(
  value: string,
  min: number,
  fieldName?: string,
): ValidationResult<string> {
  const label = fieldName ?? "Value";
  if (value.length < min) {
    return invalid<string>(`${label} must be at least ${min} characters`);
  }
  return valid(value);
}

/**
 * Validate string length with max bound.
 */
export function maxLength(
  value: string,
  max: number,
  fieldName?: string,
): ValidationResult<string> {
  const label = fieldName ?? "Value";
  if (value.length > max) {
    return invalid<string>(`${label} must be at most ${max} characters`);
  }
  return valid(value);
}

/**
 * Validate string matches a regex pattern.
 */
export function matchesPattern(
  value: string,
  pattern: RegExp,
  patternName: string,
  fieldName?: string,
): ValidationResult<string> {
  const label = fieldName ?? "Value";
  if (!pattern.test(value)) {
    return invalid<string>(`${label} must be a valid ${patternName}`);
  }
  return valid(value);
}

/**
 * Sanitize string: escape HTML to prevent XSS.
 */
export function sanitizeString(value: string): string {
  return value
    .replace(/\&/g, String.fromCharCode(38) + "amp;")
    .replace(/\</g, String.fromCharCode(60) + "lt;")
    .replace(/\>/g, String.fromCharCode(62) + "gt;")
    .replace(/"/g, String.fromCharCode(34) + "quot;")
    .replace(/'/g, String.fromCharCode(39) + "x27;")
    .trim();
}

/**
 * Validate username format (no Arabic, alphanumeric + _ - .).
 */
export const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Validate and sanitize a username.
 */
export function validateUsername(value: unknown): ValidationResult<string> {
  const name = requireString(value, "Username");
  if (!name.success) return name;

  const trimmed = name.data!.trim().toLowerCase();

  // Check min/max length
  if (trimmed.length < 2) {
    return invalid<string>("Username must be at least 2 characters");
  }
  if (trimmed.length > 30) {
    return invalid<string>("Username must be at most 30 characters");
  }

  // Check pattern
  if (!USERNAME_PATTERN.test(trimmed)) {
    return invalid<string>(
      "Username can only contain letters, numbers, hyphens, underscores, and dots",
    );
  }

  // Block reserved words
  const RESERVED_USERNAMES = new Set([
    "admin", "administrator", "system", "moderator", "support",
    "info", "help", "api", "webmaster", "postmaster",
    "security", "abuse", "noreply", "no-reply",
    "www", "mail", "ftp", "localhost", "ip4",
    "login", "logout", "signin", "sign-in",
    "signup", "sign-up", "register",
    "about", "terms", "privacy", "legal",
    "faq", "contact",
    "dashboard", "settings",
    "profile", "account", "my",
    "search", "catalog", "categories",
    "ad", "ads", "products", "marketplace",
    "metro", "souq", "souqna",
  ]);

  if (RESERVED_USERNAMES.has(trimmed)) {
    return invalid<string>("This username is reserved");
  }

  return valid<string>(trimmed);
}

/* -------------------------------------------------------------------------- */
/* Numeric validators                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Validate that a value is a valid number.
 */
export function requireNumber(value: unknown, fieldName: string): ValidationResult<number> {
  if (typeof value === "number" && !isNaN(value)) {
    return valid(value);
  }
  if (typeof value === "string") {
    const num = Number(value);
    if (!isNaN(num)) {
      return valid(num);
    }
  }
  return invalid<number>(`${fieldName} must be a valid number`);
}

/**
 * Validate number is positive.
 */
export function positiveNumber(
  value: number,
  fieldName?: string,
): ValidationResult<number> {
  const label = fieldName ?? "Value";
  if (value <= 0) {
    return invalid<number>(`${label} must be positive`);
  }
  return valid(value);
}

/**
 * Validate number is within bounds (inclusive).
 */
export function boundedNumber(
  value: number,
  min: number,
  max: number,
  fieldName?: string,
): ValidationResult<number> {
  const label = fieldName ?? "Value";
  if (value < min || value > max) {
    return invalid<number>(`${label} must be between ${min} and ${max}`);
  }
  return valid(value);
}

/**
 * Maximum storable price.
 *
 * products.price is numeric(12, 2) — 12 significant digits total, 2 after the
 * decimal point — so the largest representable value is 9999999999.99. Passing
 * anything larger raises a Postgres "numeric field overflow" (22003) at insert
 * time rather than a clean 400, so validate against this before hitting the DB.
 */
export const MAX_PRICE = 9_999_999_999.99;

/**
 * Validate price (non-negative, max 2 decimal places, within DB column range).
 */
export function validatePrice(value: unknown): ValidationResult<number> {
  const num = requireNumber(value, "Price");
  if (!num.success) return num;

  if (num.data! < 0) {
    return invalid<number>("Price cannot be negative");
  }

  if (num.data! > MAX_PRICE) {
    return invalid<number>(
      `Price cannot exceed ${MAX_PRICE.toLocaleString("en-US")}`
    );
  }

  // Check decimal places
  const str = num.data!.toString();
  const decimalIndex = str.indexOf(".");
  if (decimalIndex !== -1) {
    const decimals = str.split(".")[1];
    if (decimals && decimals.length > 2) {
      return invalid<number>("Price cannot have more than 2 decimal places");
    }
  }

  return valid(num.data!);
}

/**
 * Validate pagination parameters.
 */
export function validatePagination(
  pageVal: unknown,
  limitVal: unknown,
): ValidationResult<{ page: number; limit: number; offset: number }> {
  if (!Number.isInteger(pageVal) || (pageVal as number) < 1) {
    return invalid<{ page: number; limit: number; offset: number }>("Page must be a positive integer");
  }
  if (!Number.isInteger(limitVal) || (limitVal as number) < 1) {
    return invalid<{ page: number; limit: number; offset: number }>("Limit must be a positive integer");
  }

  const pageNum = Math.max(1, pageVal as number);
  const limitNum = Math.min(Math.max(1, limitVal as number), 100);
  const offset = (pageNum - 1) * limitNum;

  return valid({ page: pageNum, limit: limitNum, offset });
}

/* -------------------------------------------------------------------------- */
/* URL / Email validators                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Validate that a string is a valid URL or empty.
 */
export function optionalUrl(value: unknown): ValidationResult<string> {
  if (!value || typeof value !== "string" || value.trim() === "") {
    return valid("");
  }

  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) {
      return invalid<string>("URL must use http or https protocol");
    }
    return valid(value.trim());
  } catch {
    return invalid<string>("Invalid URL format");
  }
}

/**
 * Validate email format (basic check).
 */
export function validateEmail(value: unknown): ValidationResult<string> {
  const email = requireString(value, "Email");
  if (!email.success) return email;

  // Basic email pattern
  const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!EMAIL_PATTERN.test(email.data!)) {
    return invalid<string>("Invalid email format");
  }

  return valid(email.data!.toLowerCase());
}

/**
 * Validate phone number (Egyptian format +20 or 0).
 */
export function validatePhone(value: unknown): ValidationResult<string> {
  const phone = requireString(value, "Phone");
  if (!phone.success) return phone;

  // Allow Egyptian formats: +20XXXXXXXXXX or 0XXXXXXXXXX
  const PHONE_PATTERN = /^(\+20|0)?1[0125]\d{8}$/;
  if (!PHONE_PATTERN.test(phone.data!.replace(/[\s-]/g, ""))) {
    return invalid<string>("Invalid Egyptian phone number format");
  }

  return valid(phone.data!);
}

/* -------------------------------------------------------------------------- */
/* Category / ID validators                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Validate that an ID is a non-empty string (truncated to 24 chars for ObjectId).
 */
export function validateId(
  value: unknown,
  fieldName?: string,
): ValidationResult<string> {
  const id = requireString(value, fieldName ?? "ID");
  if (!id.success) return id;

  // Truncate to 24 chars (MongoDB ObjectId length)
  const trimmed = id.data!.trim();
  if (trimmed.length === 0) {
    return invalid<string>("ID cannot be empty");
  }

  return valid(trimmed.slice(0, 24));
}

/**
 * Validate category slug.
 */
export function validateCategorySlug(
  value: unknown,
): ValidationResult<string> {
  const slug = requireString(value, "Category");
  if (!slug.success) return slug;

  const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  if (!SLUG_PATTERN.test(slug.data!)) {
    return invalid<string>("Invalid category slug format");
  }

  return valid(slug.data!.toLowerCase());
}

/* -------------------------------------------------------------------------- */
/* Search query validator                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Validate and sanitize a search query.
 */
export function validateSearchQuery(
  value: unknown,
): ValidationResult<string> {
  const query = requireString(value, "Search query");
  if (!query.success) return query;

  const trimmed = query.data!.trim();

  // Min 2 characters for search
  if (trimmed.length < 2) {
    return invalid<string>("Search query must be at least 2 characters");
  }

  // Max 200 characters
  if (trimmed.length > 200) {
    return invalid<string>("Search query must be at most 200 characters");
  }

  // Sanitize
  return valid(trimmed);
}

/* -------------------------------------------------------------------------- */
/* Ad validation                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Validate ad title.
 */
export function validateAdTitle(
  value: unknown,
): ValidationResult<string> {
  const title = requireString(value, "Title");
  if (!title.success) return title;

  const trimmed = title.data!.trim();

  if (trimmed.length < 5) {
    return invalid<string>("Ad title must be at least 5 characters");
  }
  if (trimmed.length > 100) {
    return invalid<string>("Ad title must be at most 100 characters");
  }

  return valid(trimmed);
}

/**
 * Validate ad description.
 */
export function validateAdDescription(
  value: unknown,
): ValidationResult<string> {
  const desc = requireString(value, "Description");
  if (!desc.success) return desc;

  const trimmed = desc.data!.trim();

  if (trimmed.length < 10) {
    return invalid<string>("Description must be at least 10 characters");
  }
  if (trimmed.length > 5000) {
    return invalid<string>("Description must be at most 5000 characters");
  }

  return valid(trimmed);
}

/**
 * Sanitize user input to prevent XSS.
 * Escapes HTML special characters.
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/\&/g, String.fromCharCode(38) + "amp;")
    .replace(/\</g, String.fromCharCode(60) + "lt;")
    .replace(/\>/g, String.fromCharCode(62) + "gt;")
    .replace(/"/g, String.fromCharCode(34) + "quot;")
    .replace(/'/g, String.fromCharCode(39) + "x27;")
    .replace(/`/g, String.fromCharCode(96) + "96;")
    .replace(/\//g, String.fromCharCode(47) + "x2F;");
}

/**
 * Validate a boolean value.
 */
export function validateBoolean(
  value: unknown,
  fieldName?: string,
): ValidationResult<boolean> {
  const label = fieldName ?? "Value";
  if (typeof value !== "boolean") {
    return invalid<boolean>(`${label} must be a boolean`);
  }
  return valid(value);
}

/**
 * Validate file type for upload.
 */
export function validateFileType(
  filename: unknown,
  allowedTypes: string[],
): ValidationResult<string> {
  if (typeof filename !== "string") {
    return invalid<string>("Invalid filename");
  }

  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) {
    return invalid<string>("File must have an extension");
  }

  const mimeType = `image/${ext}`;
  if (!allowedTypes.includes(mimeType) && !allowedTypes.includes(ext)) {
    return invalid<string>(
      `Only the following file types are allowed: ${allowedTypes.join(", ")}`,
    );
  }

  return valid(ext);
}

/**
 * Validate file size (in bytes).
 */
export function validateFileSize(
  size: unknown,
  maxSizeBytes: number,
  fieldName?: string,
): ValidationResult<number> {
  const num = requireNumber(size, fieldName ?? "File size");
  if (!num.success) return num;

  if (num.data! > maxSizeBytes) {
    const mb = maxSizeBytes / (1024 * 1024);
    return invalid<number>(`File size must not exceed ${mb}MB`);
  }

  if (num.data! <= 0) {
    return invalid<number>("File size must be positive");
  }

  return valid(num.data!);
}

/**
 * Combined file upload validation.
 */
export function validateFileUpload(
  filenameVal: unknown,
  sizeVal: unknown,
  maxFileSize: number = 5 * 1024 * 1024, // 5MB default
  allowedTypes: string[] = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/jpg",
  ],
): ValidationResult<{ ext: string; size: number }> {
  if (typeof filenameVal !== "string") {
    return invalid<{ ext: string; size: number }>("Invalid filename");
  }
  if (typeof sizeVal !== "number" || sizeVal <= 0) {
    return invalid<{ ext: string; size: number }>("File size must be positive");
  }
  if (sizeVal > maxFileSize) {
    const mb = maxFileSize / (1024 * 1024);
    return invalid<{ ext: string; size: number }>(`File size must not exceed ${mb}MB`);
  }

  const ext = filenameVal.split(".").pop()?.toLowerCase();
  if (!ext) {
    return invalid<{ ext: string; size: number }>("File must have an extension");
  }

  const mimeType = `image/${ext}`;
  if (!allowedTypes.includes(mimeType) && !allowedTypes.includes(ext)) {
    return invalid<{ ext: string; size: number }>(
      `Only the following file types are allowed: ${allowedTypes.join(", ")}`,
    );
  }

  return valid({ ext, size: sizeVal });
}

/* -------------------------------------------------------------------------- */
/* Mass assignment prevention                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Pick only allowed properties from an object.
 * Prevents mass assignment attacks.
 */
export function pickAllowed<
  T extends Record<string, unknown>,
  K extends keyof T,
>(obj: T, allowed: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of allowed) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Filter out dangerous properties (id, role, isAdmin, etc.).
 */
export function stripSensitiveFields(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const SENSITIVE_FIELDS = new Set([
    "id",
    "role",
    "isAdmin",
    "password",
    "__v",
    "googleId",
    "email",
  ]);
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!SENSITIVE_FIELDS.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

/* -------------------------------------------------------------------------- */
/* Rate limiting helpers (preparation)                                          */
/* -------------------------------------------------------------------------- */

/**
 * In-memory rate limiter (preparation for Redis implementation).
 * Replace with Redis-backed limiter in production.
 */
export class RateLimiter {
  private map = new Map<
    string,
    { count: number; resetAt: number }
  >();

  /**
   * Check if a key has exceeded the rate limit.
   *
   * @param key - Identifier (e.g., IP address or user ID)
   * @param maxRequests - Maximum requests per window
   * @param windowMs - Window size in milliseconds
   * @returns true if allowed, false if rate limited
   */
  isAllowed(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.map.get(key);

    if (!entry || now > entry.resetAt) {
      this.map.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (entry.count >= maxRequests) {
      return false;
    }

    entry.count += 1;
    return true;
  }

  /**
   * Get remaining requests for a key.
   */
  getRemaining(key: string, maxRequests: number): number {
    const entry = this.map.get(key);
    if (!entry) return maxRequests;
    return Math.max(0, maxRequests - entry.count);
  }
}

// Singleton instance for API routes
export const apiRateLimiter = new RateLimiter();
export const commentRateLimiter = new RateLimiter();
export const favoriteRateLimiter = new RateLimiter();
export const reportRateLimiter = new RateLimiter();
export const loginRateLimiter = new RateLimiter();