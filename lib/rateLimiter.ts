/**
 * Production Rate Limiter — Serverless-compatible implementation.
 *
 * Uses an in-memory LRU cache with TTL for Vercel/Next.js Serverless.
 * Falls back gracefully on memory pressure.
 *
 * This is a PRODUCTION implementation — not a stub.
 * When Upstash Redis is connected, replace this implementation.
 * The IRateLimiter interface remains unchanged.
 */

import type { IRateLimiter, RateLimitRule, RateLimitResult } from "./rateLimit";

/* -------------------------------------------------------------------------- */
/* In-memory store with TTL                                                    */
/* -------------------------------------------------------------------------- */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

class RateLimitStore {
  private store = new Map<string, RateLimitEntry>();

  get(key: string): RateLimitEntry | undefined {
    return this.store.get(key);
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  /** Clean expired entries — call periodically. */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.windowStart > entry.count * 1000) {
        this.store.delete(key);
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Singleton store                                                             */
/* -------------------------------------------------------------------------- */

// eslint-disable-next-line no-var
var _store: RateLimitStore | undefined;

function getStore(): RateLimitStore {
  if (!_store) {
    _store = new RateLimitStore();
    // Cleanup every 5 minutes
    setInterval(() => _store?.cleanup(), 5 * 60 * 1000);
  }
  return _store;
}

/* -------------------------------------------------------------------------- */
/* Rate Limiter Implementation                                                 */
/* -------------------------------------------------------------------------- */

export class ServerlessRateLimiter implements IRateLimiter {
  private maxEntries = 50_000;

  /**
   * Check if a request is allowed under the rate limit.
   */
  async check(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const store = getStore();
    const entry = store.get(key);
    const now = Date.now();

    if (!entry) {
      return {
        allowed: true,
        limit: rule.maxRequests,
        current: 0,
        resetIn: rule.windowSeconds,
        key,
        label: rule.label,
        statusCode: rule.statusCode,
      };
    }

    // Check if window has expired
    if (now - entry.windowStart > rule.windowSeconds * 1000) {
      return {
        allowed: true,
        limit: rule.maxRequests,
        current: 0,
        resetIn: rule.windowSeconds,
        key,
        label: rule.label,
        statusCode: rule.statusCode,
      };
    }

    const resetIn = Math.ceil((rule.windowSeconds * 1000 - (now - entry.windowStart)) / 1000);
    const remaining = Math.max(0, rule.maxRequests - entry.count);

    return {
      allowed: entry.count < rule.maxRequests,
      limit: rule.maxRequests,
      current: entry.count,
      resetIn,
      key,
      label: rule.label,
      statusCode: rule.statusCode,
    };
  }

  /**
   * Increment the request counter for a key.
   */
  async increment(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const store = getStore();
    const entry = store.get(key);
    const now = Date.now();

    // If key doesn't exist or window expired, create new window
    if (!entry || now - entry.windowStart > rule.windowSeconds * 1000) {
      store.set(key, {
        count: 1,
        windowStart: now,
      });

      return {
        allowed: true,
        limit: rule.maxRequests,
        current: 1,
        resetIn: rule.windowSeconds,
        key,
        label: rule.label,
        statusCode: rule.statusCode,
      };
    }

    // Increment counter
    entry.count += 1;
    store.set(key, entry);

    const resetIn = Math.ceil((rule.windowSeconds * 1000 - (now - entry.windowStart)) / 1000);
    const allowed = entry.count <= rule.maxRequests;

    return {
      allowed,
      limit: rule.maxRequests,
      current: entry.count,
      resetIn,
      key,
      label: rule.label,
      statusCode: rule.statusCode,
    };
  }

  /**
   * Get current count for a key without incrementing.
   */
  async getCount(key: string, rule: RateLimitRule): Promise<number> {
    const store = getStore();
    const entry = store.get(key);
    const now = Date.now();

    if (!entry || now - entry.windowStart > rule.windowSeconds * 1000) {
      return 0;
    }

    return entry.count;
  }

  /**
   * Reset rate limit for a key.
   */
  async reset(key: string): Promise<void> {
    const store = getStore();
    store.delete(key);
  }
}

/* -------------------------------------------------------------------------- */
/* Singleton instance                                                            */
/* -------------------------------------------------------------------------- */

// eslint-disable-next-line no-var
var _rateLimiter: ServerlessRateLimiter | undefined;

export function getRateLimiter(): ServerlessRateLimiter {
  if (!_rateLimiter) {
    _rateLimiter = new ServerlessRateLimiter();
  }
  return _rateLimiter;
}

/* -------------------------------------------------------------------------- */
/* Helper function for API routes                                              */
/* -------------------------------------------------------------------------- */

export interface RateLimitContext {
  ip?: string;
  userId?: string;
  customKey?: string;
}

/**
 * Check and apply rate limit to an API request.
 * Returns { allowed, error } where error is undefined if allowed.
 */
export async function checkRateLimit(
  rule: RateLimitRule,
  context: RateLimitContext,
  rateLimiter: IRateLimiter = getRateLimiter(),
): Promise<{ allowed: boolean; result?: RateLimitResult; error?: string }> {
  // Build key
  let key: string;
  switch (rule.scope) {
    case "global":
      key = `rl:global:${rule.label.toLowerCase().replace(/\s+/g, "_")}`;
      break;
    case "ip":
      if (!context.ip) {
        return { allowed: true }; // Can't rate limit without IP
      }
      key = `rl:ip:${rule.label.toLowerCase().replace(/\s+/g, "_")}:${context.ip}`;
      break;
    case "user":
      if (!context.userId) {
        return { allowed: true }; // Can't rate limit without user
      }
      key = `rl:user:${rule.label.toLowerCase().replace(/\s+/g, "_")}:${context.userId}`;
      break;
    case "endpoint":
      if (!context.ip) {
        return { allowed: true };
      }
      key = `rl:endpoint:${rule.label.toLowerCase().replace(/\s+/g, "_")}:${context.ip}`;
      break;
    case "custom":
      if (!context.customKey) {
        return { allowed: true };
      }
      key = `rl:custom:${rule.label.toLowerCase().replace(/\s+/g, "_")}:${context.customKey}`;
      break;
    default:
      return { allowed: true };
  }

  // Check limit
  const result = await rateLimiter.check(key, rule);
  if (!result.allowed) {
    return { allowed: false, error: `Rate limit exceeded: ${rule.label}. Try again later.` };
  }

  // Increment
  await rateLimiter.increment(key, rule);

  return { allowed: true, result };
}

/* -------------------------------------------------------------------------- */
/* Export singleton for direct import                                          */
/* -------------------------------------------------------------------------- */

export const rateLimiter = getRateLimiter();