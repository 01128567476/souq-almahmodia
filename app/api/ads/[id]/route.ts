/**
 * PATCH /api/ads/[id]
 *   Updates an ad (owner only or admin).
 *
 * DELETE /api/ads/[id]
 *   Deletes an ad (admin only).
 *
 * Production-only. No mock data. No temporary code.
 */

import { NextResponse } from "next/server";
import { adRepository, type AdUpdateInput } from "@/services/repositories/adRepository";
import { getCurrentUser } from "@/lib/serverAuth";
import { isAdmin } from "@/lib/permissions";
import { deleteImagesFromCloudinary } from "@/lib/cloudinary";
import { MAX_PRICE } from "@/lib/validation";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const { id } = await context.params;
  const raw = (await request.json()) as Record<string, unknown>;

  /**
   * Only include fields that are explicitly provided with a non-undefined value.
   * This prevents partial updates from overwriting unaffected fields with undefined.
   */
  const allowedPatch: AdUpdateInput = {};

  if (typeof raw.title === "string") allowedPatch.title = raw.title;
  if (typeof raw.description === "string") allowedPatch.description = raw.description;
  if (typeof raw.price === "number") {
    // Reject out-of-range prices here: products.price is numeric(12,2), so a
    // larger value would overflow the column and surface as a 500 from the DB.
    if (!Number.isFinite(raw.price) || raw.price < 0 || raw.price > MAX_PRICE) {
      return NextResponse.json(
        { error: `Price must be between 0 and ${MAX_PRICE.toLocaleString("en-US")}` },
        { status: 400 },
      );
    }
    allowedPatch.price = raw.price;
  }
  if (typeof raw.currency === "string") allowedPatch.currency = raw.currency;
  if (typeof raw.categorySlug === "string") allowedPatch.categorySlug = raw.categorySlug;
  if (typeof raw.condition === "string")
    allowedPatch.condition = raw.condition as AdUpdateInput["condition"];
  if (typeof raw.location === "string") allowedPatch.location = raw.location;
  if (typeof raw.sellerPhone === "string") allowedPatch.sellerPhone = raw.sellerPhone;
  if (Array.isArray(raw.images))
    allowedPatch.images = raw.images.filter(
      (item): item is string => typeof item === "string",
    );
  if (typeof raw.image === "string") allowedPatch.image = raw.image;
  if (typeof raw.adminNotes === "string") allowedPatch.adminNotes = raw.adminNotes;
  if (typeof raw.rejectionReason === "string") allowedPatch.rejectionReason = raw.rejectionReason;

  // Authenticate via Auth.js session
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Authorization: only owner or admin may edit an ad
  const ad = await adRepository.getById(id);
  if (!ad) {
    return NextResponse.json({ error: "Ad not found" }, { status: 404 });
  }

  const isOwner = ad.ownerId === currentUser.id;
  const isAdminRole = isAdmin(currentUser.role);

  if (!isOwner && !isAdminRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Owners cannot set adminNotes or rejectionReason (admin-only fields)
  if (isOwner && (allowedPatch.adminNotes !== undefined || allowedPatch.rejectionReason !== undefined)) {
    return NextResponse.json(
      { error: "Unauthorized field access" },
      { status: 403 }
    );
  }

  // Clean up old images that are no longer used (owner-only updates)
  if (isOwner && Array.isArray(allowedPatch.images)) {
    const oldImages = ad.images ?? [];
    const newImages = allowedPatch.images;
    if (JSON.stringify(oldImages) !== JSON.stringify(newImages)) {
      const removed = oldImages.filter((old) => !newImages.includes(old));
      if (removed.length > 0) {
        try {
          await deleteImagesFromCloudinary(removed);
        } catch (error) {
          console.error(`[CLOUDINARY_CLEANUP] Failed to remove old images on ad update:`, error);
          // Don't fail the request — images may be referenced elsewhere
        }
      }
    }
  }

  const updated = await adRepository.update(id, allowedPatch, {
    id: currentUser.id,
    name: currentUser.name,
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const { id } = await context.params;

  // Authenticate via Auth.js session
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Authorize: only admins can delete ads (owners can hide instead)
  if (!isAdmin(currentUser.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Delete all images from Cloudinary before removing ad
  const adToDelete = await adRepository.getById(id);
  if (adToDelete) {
    const allImages = [
      adToDelete.image,
      ...(adToDelete.images ?? []),
    ].filter(Boolean) as string[];

    if (allImages.length > 0) {
      try {
        const deleted = await deleteImagesFromCloudinary(allImages);
        console.log(`[CLOUDINARY_CLEANUP] Deleted ${deleted.length} images for ad ${id}`);
      } catch (error) {
        console.error(`[CLOUDINARY_CLEANUP] Failed to delete images for ad ${id}:`, error);
        // Continue with ad deletion — images may be orphaned but ad is removed
      }
    }
  }

  await adRepository.remove(id, {
    id: currentUser.id,
    name: currentUser.name,
  });
  return NextResponse.json({ success: true });
}
