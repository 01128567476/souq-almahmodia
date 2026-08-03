/**
 * Rate limiting — production abstraction layer.
 *
 * This module defines the rate limiting contract.
 * The concrete implementation uses Upstash Redis (to be connected later).
 *
 * NO temporary implementations. NO stubs. NO mocks.
 * This is pure architecture — ready for any Redis implementation.
 *
 * Architecture:
 * - IRateLimiter interface defines the contract
 * - Rate limit rules are declared in RATE_LIMIT_RULES
 * - Rate limiting middleware wraps API routes
 * - Upstash Redis implements the interface later
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Result of a rate limit check.
 * Used by middleware to decide whether to allow or reject the request.
 */
export interface RateLimitResult {
  /** Whether the request is within the limit. */
  allowed: boolean;
  /** Maximum number of requests allowed in the window. */
  limit: number;
  /** Number of requests already made in the current window. */
  current: number;
  /** Number of seconds until the window resets. 
  */
  resetIn: number; /** Key used to track this rate limit (for debugging). */
  key: string;
  /** Human-readable label for this rate limit (from the rule). */
  label?: string;
  /** HTTP status code for this rate limit result. */
  statusCode?: number;
}

/**
 * Rate limiter interface — the contract for any implementation.
 * 
 * Upstash Redis will implement this interface later.
 * No changes to calling code will be required.
 */
export interface IRateLimiter {
  /**
   * Check if a request is allowed under the rate limit.
   * @param key - Unique identifier for this rate limit rule (e.g., "ip:1.2.3.4", "user:abc123")
   * @param rule - The rate limit rule to apply
   * @returns RateLimitResult with allow/deny decision and metadata
   */
  check(key: string, rule: RateLimitRule): Promise<

RateLimitResult>;  /**
   * Increment the request counter for a key.
   * Called after a successful request to track usage.
   * @param key - Unique identifier for this rate limit rule
   * @param rule - The rate limit rule to apply
   * @returns Updated RateLimitResult
   */
  increment(key: string, rule: RateLimitRule): Promise<RateLimitResult>;
}

/**
 * Rate limit rule definition.
 * Declares what limit applies to which scope and duration.
 */
export interface RateLimitRule {
  /**
   * Maximum number of requests allowed in the window.
   */
  maxRequests: number;

  /**
   * Window duration in seconds.
   * e.g., 60 = 1 minute, 3600 = 1 hour
   */
  windowSeconds: number;

  /**
   * Scope of the rate limit:
   * - "global": applies to all users/IPs
   * - "ip": applies per client IP address
   * - "user": applies per authenticated user ID
   * - "endpoint": applies per IP + endpoint combination
   * - "custom": applies with a custom key provided at check time
   */
  scope: "global" | "ip" | "user" | "endpoint" | "custom";

  /**
   * Human-readable label for this rule (used in error messages).
   */
  label: string;

  /**
   * HTTP status code to return when rate limited.
   * Defaults to 429 (Too Many Requests).


   */
  statusCode?: number;  /**
   * Whether to skip rate limiting for authenticated admin users.
   * Defaults to false.
   */
  bypassAdmin?: boolean;
}

/* -------------------------------------------------------------------------- */
                                                          /* Rate limit rules */
/* -------------------------------------------------------------------------- */

/**
 * Production rate limit rules.
 * 
 * These rules define which endpoints are rate limited and how.
 * Each rule is applied based on the endpoint's sensitivity.
 * 
 * ALL auth-related endpoints are rate limited.
 * ALL user-generated action endpoints are rate limited.
 * Read-only endpoints (GET requests) are NOT rate
 limited.
 */export const RATE_LIMIT_RULES: Record<string, RateLimitRule> = {
  /**
   * Registration — strict limit per IP.
   * Prevents mass account creation.
   */
  register: {
    maxRequests: 5,
    windowSeconds: 3600, // 1 hour per IP
    scope
 : "ip",
    label: "Registration", },

  /**
   * Login — strict limit per IP.
   * Prevents brute force attacks.
   */
  login: {
    maxRequests: 10,
    windowSeconds: 900, // 15 minutes per IP
    scope: "ip",
    label: "Login",
  },

  /**
   * Password reset — strict limit per IP.
   * Prevents email flooding.
   */
  passwordReset: {
    maxRequests: 3,
    windowSeconds: 3600, // 1 hour per IP
    scope: "ip",
    label: "Password Reset",
  },

  /**
   * Email verification/OTP — strict limit per IP.
   * Prevents OTP abuse.
   */
  otpVerification: {
    maxRequests: 5,
    windowSeconds: 3600, // 1 hour per IP
    scope: "ip",
    label: "OTP Verification",
  },

  /**
   * Comments — moderate limit per user.
   * Prevents spam comments.
   */
  createComment: {
    maxRequests: 20,
    windowSeconds: 3600, // 1 hour per user
    scope:    "user",
    label: "Comment Creation",
 bypassAdmin: true,
  },

  /**
   * Reports — strict limit per user per ad.
   * Prevents duplicate/flooding reports.
   */
  createReport: {
    maxRequests: 5,
    windowSeconds: 3600, // 1 hour per user
    scope: "user",
    label: "Report Creation",
    bypassAdmin: true,
  },

  /**
   * Favorites — moderate limit per user.
   * Prevents rapid favoriting abuse.
   */
  toggleFavorite: {
    maxRequests: 60,
    windowSeconds: 60, // 1 minute per user
    scope: "user",
    label: "Favorite Toggling",
    bypassAdmin: true,
  },

  /**
   * Reactions — moderate limit per user.
   * Prevents rapid reaction abuse.
   */
  toggleReaction: {
    maxRequests: 60,
    windowSeconds: 60, // 1 minute per user
    scope: "user",
    label: "Reaction Toggling",
    bypassAdmin: true,
  },

  /**
   * Ad creation — moderate limit per user.
   * Prevents mass spam ad creation.
   */
  createAd: {
    maxRequests: 10,
    windowSeconds: 3600, // 1 hour per user
    scope: "user",
    label: "Ad Creation",
    bypassAdmin: false,
  },

  /**
   * Search — moderate limit per IP.
   * Prevents search engine abuse.
   */
  search: {
    maxRequests: 30,
    windowSeconds: 60, // 1 minute per IP
    scope: "ip",
    label: "Search",
  },
};

/* -------------------------------------------------------------------------- */
/* Middleware integration points                                               */
/* -------------------------------------------------------------------------- */

/**
 * Rate limit middleware signature for Next.js API routes.
 * 
 * This is the integration point where rate limiting will be applied.
 * When Upstash Redis is connected, the middleware will call the
 * concrete IRateLimiter implementation.
 * 
 * Usage pattern (to be implemented later):
 * ```
 * export async function POST(request: Request) {
 *   const result = await rateLimiterMiddleware(
 *     request,
 *     RATE_LIMIT_RULES.register
 *   );
 *   if (!result.allowed) {
 *     return NextResponse.json(
 *       { error: "Too many requests. Try again later." },
 *       { status: result.statusCode ?? 429 }
 *     );
 *   }
 *   // ... proceed with handler
 * }

 * ```
 */export type RateLimitMiddleware = (
  request: Request,
  rule: RateLimitRule,
) => Promise<RateLimitResult>;

/* -------------------------------------------------------------------------- */
                                                              /* Key builders */
/* -------------------------------------------------------------------------- */

/**
 * Builds rate limit keys based on the rule scope.
 * These keys will be used by the Redis implementation.
 */
export const RateLimitKeyBuilder = {
  /**
   * Build a key for "global" scope.
   */
  global(rule: RateLimitRule): string {
    return `rl:global:${rule.label.toLowerCase().replace(/\s+/g, "_")}`;
  },

  /**
   * Build a key for "ip" scope.
   * @param ip - Client IP address
   */
  ip(rule: RateLimitRule, ip: string): string {
    return `rl:ip:${rule.label.toLowerCase().replace(/\s+/g, "_")}:${ip}`;
  },

  /**
   * Build a key for "user" scope.
   * @param userId - Authenticated user ID
   */
  user(rule: RateLimitRule, userId: string): string {
    return `rl:user:${rule.label.toLowerCase().replace(/\s+/g, "_")}:${userId}`;
  },

  /**
   * Build a key for "endpoint" scope.
   * @param ip - Client IP address
   * @param endpoint - API endpoint path
   */
  endpoint(rule: RateLimitRule, ip: string, endpoint: string): string {
    return `rl:endpoint:${rule.label.toLowerCase().replace(/\s+/g, "_")}:${ip}:${endpoint}`;
  },

  /**
   * Build a key for "custom" scope.
   * @param customKey - Custom key string provided by the caller
   */
  custom(rule: RateLimitRule, customKey: string): string {
    return `rl:custom:${rule.label.toLowerCase().replace(/\s+/g, "_")}:${customKey}`;
  },

  /**
   * Build a rate limit key based on scope and context.
   * This is the primary entry point for key generation.
   */
  build(
    rule: RateLimitRule,
    context: {
      ip?: string;
      userId?: string;
      customKey?: string;
      endpoint?: string;
    },
  ): string {
    switch (rule.scope) {
      case "global":
        return RateLimitKeyBuilder.global(rule);
      case "ip":
        if (!context.ip) {
          throw new Error("IP is required for 'ip' scope rate limits");
        }
        return RateLimitKeyBuilder.ip(rule, context.ip);
      case "user":
        if (!context.userId) {
          throw new Error("User ID is required for 'user' scope rate limits");
        }
        return RateLimitKeyBuilder.user(rule, context.userId);
      case "endpoint":
        if (!context.ip || !context.endpoint) {
          throw new Error("IP and endpoint are required for 'endpoint' scope");
        }
        return RateLimitKeyBuilder.endpoint(rule, context.ip, context.endpoint);
      case "custom":
        if (!context.customKey) {
          throw new Error("Custom key is required for 'custom' scope");
        }
        return RateLimitKeyBuilder.custom(rule, context.customKey);
      default:
        throw new Error(`Unknown rate limit scope: ${rule.scope}`);
    }
  },
};

/* -------------------------------------------------------------------------- */
/* HTTP helpers for rate limit responses                                      */
/* -------------------------------------------------------------------------- */

/**
 * Build standard HTTP rate limit headers.
 * These headers are included in ALL responses (allowed or denied).
 */
export function buildRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(Math.max(0, result.limit - result.current)),
    "X-RateLimit-Reset": String(result.resetIn),
  };
}

/**
 * Build a rate-limited HTTP response.
 * Returns a NextResponse with standard error format.
 */
export function buildRateLimitResponse(
  result: RateLimitResult,
): Response {
  return new Response(
    JSON.stringify({
      error: `Rate limit exceeded: ${result.label || "too many requests"}. Please try again later.`,
      retryAfter: result.resetIn,
    }),
    {
      status: result.statusCode ?? 429,
      headers: {
        "Content-Type": "application/json",
        ...buildRateLimitHeaders(result),
      },
    },
  );
}