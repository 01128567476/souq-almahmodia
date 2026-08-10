import { NextResponse } from "next/server";
import { adRepository } from "@/services/repositories/adRepository";
import { getCurrentUser } from "@/lib/serverAuth";
import { isAdmin } from "@/lib/permissions";
import type { AdStatus } from "@/types";
import { parsePagination, buildPaginationMeta, type PaginatedResponse } from "@/lib/pagination";
import { MAX_PRICE } from "@/lib/validation";

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

    // =========================================================
    // Strict validation for Egypt-only marketplace
    // =========================================================
    const errors: string[] = [];

    // Title: minimum 3 characters
    if (!body.title || typeof body.title !== "string" || body.title.trim().length < 3) {
      errors.push("Invalid title");
    }

    // Description: optional, no minimum length
    // (removed strict validation - user can leave description empty)

    // Price: must be positive number within the DB numeric(12,2) range.
    // Anything above MAX_PRICE overflows the column and fails at insert time.
    if (!body.price || typeof body.price !== "number" || body.price <= 0) {
      errors.push("Invalid price");
    } else if (!Number.isFinite(body.price) || body.price > MAX_PRICE) {
      errors.push(`Price cannot exceed ${MAX_PRICE.toLocaleString("en-US")}`);
    }

    // Currency: removed - always EGP automatically (no user input needed)

    // Category: required
    if (!body.categorySlug || typeof body.categorySlug !== "string") {
      errors.push("Missing categorySlug");
    }

    // Phone: Egyptian phone number (minimum 10 digits)
    if (!body.sellerPhone || typeof body.sellerPhone !== "string" || body.sellerPhone.replace(/\D/g, "").length < 10) {
      errors.push("Invalid Egyptian phone number");
    }

    // Condition: must be valid DB enum value (new, excellent, good, fair)
    const validConditions = ["new", "excellent", "good", "fair"];
    if (!validConditions.includes(body.condition)) {
      errors.push("Condition must be 'new', 'excellent', 'good', or 'fair'");
    }

    // Images: at least one required, must be array of valid URLs
    if (!body.images || !Array.isArray(body.images) || body.images.length === 0) {
      errors.push("At least one image is required");
    } else {
      // Validate each image URL is not blob:, data:, or base64
      const invalidImages = body.images.filter(
        (img: string) => img.startsWith("blob:") || img.startsWith("data:") || img.startsWith("base64")
      );
      if (invalidImages.length > 0) {
        errors.push("Invalid image URLs detected. Please re-upload your images.");
      }
    }

    // Location: optional but validate if provided
    if (body.location && typeof body.location !== "string") {
      errors.push("Invalid location format");
    }

    // Return validation errors
    if (errors.length > 0) {
      console.error("[ADS_CREATE] Validation failed:", errors);
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    // =========================================================
    // Normalize values for Egypt-only marketplace
    // =========================================================
    const currency = "EGP";
    const condition = validConditions.includes(body.condition) ? body.condition : "good";
    const title = body.title.trim();
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const price = Number(body.price);
    const categorySlug = body.categorySlug;
    const sellerPhone = body.sellerPhone.trim();
    const images = body.images.filter((img: string) => 
      !img.startsWith("blob:") && !img.startsWith("data:") && !img.startsWith("base64")
    );
    const location = body.location?.trim() || "Egypt";

    // Debug logging
    console.log("[ADS_CREATE] Final payload:", {
      title,
      description,
      price,
      currency,
      categorySlug,
      condition,
      sellerPhone,
      location,
      imagesCount: images.length,
      ownerId: currentUser.id,
    });

    // =========================================================
    // Database insert
    // =========================================================
    const ad = await adRepository.create(
      {
        title,
        description,
        price,
        currency,
        categorySlug,
        condition,
        location,
        sellerName: currentUser.name || "User",
        sellerPhone,
        images,
        image: images[0],
        postedAgoHours: 0,
        ownerId: currentUser.id,
      },
      { id: currentUser.id, name: currentUser.name || "User" }
    );

    return NextResponse.json(ad, { status: 201 });
  } catch (err) {
    console.error("[ADS_CREATE] DB ERROR:", err);
    return NextResponse.json(
      { 
        error: err instanceof Error ? err.message : "Database insert failed",
        type: err instanceof Error ? err.name : "Unknown"
      },
      { status: 400 }
    );
  }
}
