import { NextResponse } from "next/server";
import { userRepository } from "@/services/repositories/userRepository";
import { parsePagination, buildPaginationMeta, type PaginatedResponse } from "@/lib/pagination";

/**
 * GET /api/users
 *   User directory listing with pagination.
 *   Returns paginated list of users (public-facing, no auth required).
 *   Query params: page, limit
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const { page, limit } = parsePagination(Object.fromEntries(url.searchParams.entries()));
  const offset = (page - 1) * limit;

  const users = await userRepository.list();

  // Manual pagination (repository doesn't support offset yet)
  const total = users.length;
  const paginatedUsers = users.slice(offset, offset + limit);
  const meta = buildPaginationMeta({ page, limit }, total);

  const response: PaginatedResponse<typeof users[number]> = {
    data: paginatedUsers,
    meta,
  };

  return NextResponse.json(response);
}
