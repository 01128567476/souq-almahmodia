/**
 * Shared pagination utilities.
 *
 * Strategy: offset-based with limit + cursor support.
 * Consistent across ALL listing endpoints.
 */

export interface PaginationParams {
  /** Page number (1-based). Defaults to 1. */
  page?: string;
  /** Items per page. Defaults to 20, max 100. */
  limit?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Parse and validate pagination parameters from query string.
 */
export function parsePagination(query: Record<string, string | string[]>): {
  page: number;
  limit: number;
} {
  const page = parseInt(String(query.page ?? "1"), 10);
  const limit = parseInt(String(query.limit ?? "20"), 10);

  return {
    page: Math.max(1, isNaN(page) ? 1 : page),
    limit: Math.max(1, Math.min(100, isNaN(limit) ? 20 : limit)),
  };
}

/**
 * Build pagination metadata.
 */
export function buildPaginationMeta(
  params: { page: number; limit: number },
  total: number,
): PaginationMeta {
  const { page, limit } = params;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * Build offset/limit for SQL queries.
 */
export function getPaginationOffset(params: { page: number; limit: number }): {
  offset: number;
  limit: number;
} {
  const { page, limit } = params;
  return {
    offset: (page - 1) * limit,
    limit,
  };
}