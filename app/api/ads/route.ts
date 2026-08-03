import { NextResponse } from "next/server";
import { adRepository } from "@/services/repositories/adRepository";
import { getCurrentUser } from "@/lib/serverAuth";
import { isAdmin } from "@/lib/permissions";
import type { AdStatus } from "@/types";
import { parsePagination, buildPaginationMeta, type PaginatedResponse } from "@/lib/pagination";

/**
 * GET /api/ads
 *   Admin ad listing with pagination.
 *   Requires: admin authentication.
 *   Query params: statuses, search, categorySlug, page, limit
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const statuses = url.searchParams.get("statuses")?.split(",").filter(Boolean) as AdStatus[];
  const search = url.searchParams.get("search")?.trim() || undefined;
  const categorySlug = url.searchParams.get("categorySlug") || undefined;

  // Pagination
  const { page, limit } = parsePagination(Object.fromEntries(url.searchParams.entries()));
  const offset = (page - 1) * limit;

  // Authentication + Authorization
  const currentUser = await getCurrentUser();
  if (!currentUser || !isAdmin(currentUser.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const ads = await adRepository.list({
    statuses: statuses?.length ? statuses : undefined,
    search,
    categorySlug,
  });

  // Manual pagination (repository doesn't support offset yet)
  const total = ads.length;
  const paginatedAds = ads.slice(offset, offset + limit);
  const meta = buildPaginationMeta({ page, limit }, total);

  const response: PaginatedResponse<typeof ads[number]> = {
    data: paginatedAds,
    meta,
  };

  return NextResponse.json(response);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const ad = await adRepository.create(
      {
        title: body.title,
        description: body.description,
        price: body.price,
        currency: body.currency || "SAR",
        categorySlug: body.categorySlug,
        condition: body.condition || "excellent",
        location: body.location || "Your Location",
        sellerName: currentUser.name,
        sellerPhone: body.sellerPhone,
        images: body.images,
        image: body.image,
        postedAgoHours: 0,
        ownerId: currentUser.id,
      },
      { id: currentUser.id, name: currentUser.name }
    );

    return NextResponse.json(ad, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create advertisement" },
      { status: 400 }
    );
  }
}
