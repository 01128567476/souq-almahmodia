/**
 * Image utilities for validating and normalizing image sources.
 * Prevents empty string src attributes that cause React warnings.
 */

/**
 * Validates an image source string.
 * Returns null if src is empty, null, undefined, or only whitespace.
 * 
 * @param src - The image source to validate
 * @returns Valid URL string or null
 * 
 * @example
 * getValidImage("https://example.com/img.jpg") // "https://example.com/img.jpg"
 * getValidImage("") // null
 * getValidImage(null) // null
 * getValidImage("   ") // null
 */
export function getValidImage(src: string | null | undefined): string | null {
  if (!src || typeof src !== 'string' || src.trim() === '') {
    return null;
  }
  return src.trim();
}

/**
 * Normalizes an image/avatar field from database or API response.
 * Ensures the value is either a valid string or null (never empty string).
 * 
 * @param value - The image source value to normalize
 * @returns Normalized string or null
 * 
 * @example
 * normalizeImageField(user.avatar) // "https://..." or null
 */
export function normalizeImageField(value: string | null | undefined): string | null {
  return getValidImage(value);
}

/**
 * Extracts the first character from a name for avatar fallback.
 * 
 * @param name - The display name
 * @returns First character uppercase or "?"
 */
export function getInitialFromName(name: string | null | undefined): string {
  if (!name || name.trim() === '') return '?';
  return name.trim().charAt(0).toUpperCase();
}