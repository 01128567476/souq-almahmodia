import { NextRequest, NextResponse } from "next/server";
import { userRepository } from "@/services/repositories/userRepository";
import { parsePagination, buildPaginationMeta, type PaginatedResponse } from "@/lib/pagination";

/**
 * GET /api/users
 * 
 * Public user directory with DB-level pagination.
 * Returns a paginated list of verified users.
 * 
 * SECURITY: Only returns verified users (emailVerified IS NOT NULL).
 * Hides sensitive fields (phone, role, joinedDate).
 * 
 * Query params:
 * - page: page number (default: 1)
 * - limit: items per page (default: 20, max: 100)
 * - search: filter by name or username (ILIKE)
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const { page, limit } = parsePagination(Object.fromEntries(url.searchParams.entries()));
    const search = url.searchParams.get("search")?.trim() || undefined;

    const result = await userRepository.listPaginated(page, limit, search);

    const response: PaginatedResponse<{ id: string; name: string; email: string; avatar: string; username?: string; adsCount: number; status: string }> = {
      data: result.users,
      meta: { page: result.meta.page, limit: result.meta.limit, total: result.meta.total, totalPages: result.meta.totalPages, hasMore: result.meta.hasMore },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[USERS_LIST_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
