import { NextRequest, NextResponse } from "next/server";
import { categoryRepository } from "@/services/repositories/categoryRepository";
import { getCurrentUser, isAdmin } from "@/lib/serverAuth";

/**
 * POST /api/categories/reorder
 *
 * Admin-only endpoint. Reorders categories by slug list.
 *
 * Request body: { order: string[] } — array of category slugs in new order
 * Response: updated categories list
 *
 * SECURITY: Requires authenticated admin session.
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Authorization check — admin only
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Parse and validate body
    const payload = (await request.json()) as { order?: string[] };
    if (!payload.order || !Array.isArray(payload.order) || payload.order.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: 'order' array is required" },
        { status: 400 }
      );
    }

    // Reorder categories
    const categories = await categoryRepository.reorder(payload.order);

    return NextResponse.json(categories);
  } catch (error) {
    console.error("[CATEGORIES_REORDER_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to reorder categories" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";