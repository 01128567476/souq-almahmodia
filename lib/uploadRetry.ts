/**
 * Upload Retry with Exponential Backoff
 *
 * Automatically retries failed uploads with configurable attempts.
 * Uses exponential backoff to handle transient errors.
 *
 * Features:
 * - Configurable retry count (default: 1 → 2 total attempts)
 * - Exponential backoff: 1s, 2s
 * - Optional timeout protection (10s per attempt)
 * - Last error propagated after all retries exhausted
 */

/**
 * Execute a function with retry and exponential backoff.
 *
 * @param fn - Async function to retry
 * @param retries - Number of retry attempts (default: 1)
 * @param timeoutMs - Timeout per attempt in ms (default: 10000)
 * @returns Result of the function
 */
export async function retryUpload<T>(
  fn: () => Promise<T>,
  retries: number = 1,
  timeoutMs: number = 10_000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Wrap with timeout protection
      return await withTimeout(fn(), timeoutMs);
    } catch (err) {
      lastError = err;

      // Don't wait after the last attempt
      if (attempt < retries - 1) {
        const delayMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
        console.warn(
          `[retryUpload] Attempt ${attempt + 1}/${retries} failed, retrying in ${delayMs}ms`
        );
        await sleep(delayMs);
      }
    }
  }

  // All retries exhausted — throw the last error
  throw lastError;
}

/**
 * Wrap a promise with a timeout.
 *
 * @param promise - Promise to timeout
 * @param ms - Timeout in milliseconds
 * @returns Promise that rejects with timeout error if exceeded
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Operation timed out after ${ms}ms`)),
        ms
      )
    ),
  ]);
}

/**
 * Sleep for a specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}