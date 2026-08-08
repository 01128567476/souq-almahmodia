/**
 * POST /api/upload/image
 *
 * Production image upload via Cloudinary.
 *
 * Security:
 * - Auth required (401 if unauthenticated)
 * - Cloudinary API_SECRET never exposed to client
 * - Server-side uploads only
 *
 * Validation:
 * - Max 10 files
 * - Max 5MB per file
 * - Only: image/jpeg, image/png, image/webp, image/gif
 *
 * Performance:
 * - Parallel uploads via Promise.all (batch)
 * - Batch delete support for cleanup
 *
 * Optimization:
 * - All URLs transformed: f_auto,q_auto,w_800
 *
 * Returns:
 * { urls: string[] }
 */

import { NextResponse } from "next/server";
import cloudinary, { optimizeCloudinaryUrl } from "@/lib/cloudinary";
import { getViewerId } from "@/lib/serverAuth";

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 10;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

/* -------------------------------------------------------------------------- */
/* POST handler                                                                */
/* -------------------------------------------------------------------------- */

export async function POST(request: Request) {
  try {
    // --- Auth check ---
    const userId = await getViewerId();
    if (!userId) {
      return jsonError("Authentication required", 401);
    }

    // --- Parse form data (DO NOT set Content-Type header) ---
    const formData = await request.formData();
    const files = formData.getAll("files");

    if (!Array.isArray(files) || files.length === 0) {
      return jsonError("No files provided");
    }

    if (files.length > MAX_FILES) {
      return jsonError(`Maximum ${MAX_FILES} files allowed`);
    }

    // --- Validate all files first (before any upload) ---
    const validatedFiles: { file: File; type: string; size: number }[] = [];

    for (const item of files) {
      if (!(item instanceof File)) {
        return jsonError("Invalid file object");
      }

      const fileType = item.type;
      const fileSize = item.size;

      if (!ALLOWED_CONTENT_TYPES.has(fileType)) {
        return jsonError(
          `Unsupported image type: ${fileType}. Allowed: image/jpeg, image/png, image/webp, image/gif`
        );
      }

      if (fileSize > MAX_FILE_SIZE) {
        return jsonError(`File exceeds maximum size of 5MB`);
      }

      validatedFiles.push({ file: item, type: fileType, size: fileSize });
    }

    // --- Parallel upload to Cloudinary ---
    const uploadPromises = validatedFiles.map(({ file }, index) =>
      uploadToCloudinary(file, userId, index)
    );

    const results = await Promise.all(uploadPromises);

    // --- Check for any upload failures ---
    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      console.error(`[UPLOAD] ${failures.length} upload(s) failed`);
      return jsonError(`${failures.length} image(s) failed to upload. Please try again.`, 500);
    }

    // --- Extract and optimize URLs ---
    const urls = results
      .filter((r): r is { success: true; url: string } => r.success)
      .map((r) => optimizeCloudinaryUrl(r.url));

    // --- Validate all returned URLs ---
    const validUrls = urls.filter(
      (url) => url && typeof url === "string" && url.includes("cloudinary.com")
    );

    if (validUrls.length !== urls.length) {
      console.error("[UPLOAD] Some URLs failed validation");
      return jsonError("Some images failed validation. Please try again.", 500);
    }

    console.log("[UPLOAD] Success - URLs:", validUrls);

    return NextResponse.json({ urls: validUrls });
  } catch (error) {
    console.error("[UPLOAD_ERROR]", error);
    return jsonError(error instanceof Error ? error.message : "Upload failed", 500);
  }
}

/* -------------------------------------------------------------------------- */
/* Upload helper                                                               */
/* -------------------------------------------------------------------------- */

async function uploadToCloudinary(
  file: File,
  userId: string,
  index: number
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64String = buffer.toString("base64");
    const dataUri = `data:${file.type};base64,${base64String}`;

    const publicId = `souq-ads/${userId}/${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`;

    const result = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        cloudinary.uploader.upload(
          dataUri,
          {
            public_id: publicId,
            resource_type: "image",
            folder: "souq-ads",
          },
          (error, result) => {
            if (error) {
              console.error(`[UPLOAD] File ${index} failed:`, error);
              reject(error);
            } else {
              resolve(result!);
            }
          }
        );
      }
    );

    return { success: true, url: result.secure_url };
  } catch (error) {
    console.error(`[UPLOAD] File ${index} exception:`, error);
    return { success: false, error: (error as Error).message };
  }
}