/**
 * POST /api/upload/image
 *
 * Cloudinary image upload with debugging.
 * Temporarily simplified to isolate failure points.
 */

import { NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
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
/* Stream upload helper (memory efficient)                                     */
/* -------------------------------------------------------------------------- */

/**
 * Upload a single file via Cloudinary upload_stream.
 * Full debugging included to isolate failure points.
 */
async function uploadToCloudinaryStream(
  file: File,
  userId: string,
  index: number
): Promise<string> {
  console.log("[UPLOAD] Starting file", index, file.name, "size:", file.size, "type:", file.type);

  try {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).slice(2, 9);
    const publicId = `souq-ads/${userId}/${timestamp}-${index}-${randomId}`;

    console.log("[UPLOAD] Cloudinary config: folder=souq-ads, publicId=" + publicId);

    // Get buffer first
    const buffer = Buffer.from(await file.arrayBuffer());
    console.log("[UPLOAD] Buffer created:", buffer.length, "bytes");

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: "image",
          folder: "souq-ads",
          transformation: [
            { width: 800, crop: "limit" },
            { quality: "auto" },
            { fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error) {
            console.error("[CLOUDINARY ERROR]", error);
            return reject(error);
          }
          if (!result?.secure_url) {
            console.error("[CLOUDINARY NO URL]", result);
            return reject(new Error("No secure_url returned"));
          }
          console.log("[UPLOAD] Success:", result.secure_url);
          resolve(result.secure_url);
        }
      );

      stream.on("error", (err) => {
        console.error("[STREAM ERROR]", err);
        reject(err);
      });

      stream.end(buffer);
      console.log("[UPLOAD] Stream ended");
    });
  } catch (err) {
    console.error("[STREAM CRASH]", err);
    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/* POST handler                                                                */
/* -------------------------------------------------------------------------- */

export async function POST(request: Request) {
  console.log("[UPLOAD] Request received");

  try {
    // --- Auth check ---
    const userId = await getViewerId();
    if (!userId) {
      console.error("[UPLOAD] Auth failed: no userId");
      return jsonError("Authentication required", 401);
    }
    console.log("[UPLOAD] Auth passed, userId:", userId);

    // --- Parse form data ---
    const formData = await request.formData();
    const files = formData.getAll("files");
    console.log("[UPLOAD] Files count:", files.length);

    if (!Array.isArray(files) || files.length === 0) {
      return jsonError("No files provided");
    }

    if (files.length > MAX_FILES) {
      return jsonError(`Maximum ${MAX_FILES} files allowed`);
    }

    // --- Validate all files first (before any upload) ---
    const validatedFiles: File[] = [];

    for (const item of files) {
      if (!(item instanceof File)) {
        console.error("[UPLOAD] Invalid file object");
        return jsonError("Invalid file object");
      }

      const fileType = item.type;
      const fileSize = item.size;

      if (!ALLOWED_CONTENT_TYPES.has(fileType)) {
        console.error("[UPLOAD] Invalid type:", fileType);
        return jsonError(
          `Unsupported image type: ${fileType}. Allowed: image/jpeg, image/png, image/webp, image/gif`
        );
      }

      if (fileSize > MAX_FILE_SIZE) {
        console.error("[UPLOAD] File too large:", fileSize);
        return jsonError("File exceeds maximum size of 5MB");
      }

      validatedFiles.push(item);
    }

    console.log("[UPLOAD] All files validated, starting uploads...");

    // --- Upload each file sequentially (no retry, no chunks) ---
    const urls: string[] = [];

    for (let i = 0; i < validatedFiles.length; i++) {
      try {
        const url = await uploadToCloudinaryStream(validatedFiles[i], userId, i);
        urls.push(url);
      } catch (err) {
        console.error("[UPLOAD FAIL FILE]", i, err);
      }
    }

    console.log("[UPLOAD] Complete:", urls.length, "success, out of", validatedFiles.length);

    // --- Check if all uploads failed ---
    if (urls.length === 0) {
      return jsonError("All uploads failed (debug mode)", 500);
    }

    // --- Return success ---
    return NextResponse.json({ urls });
  } catch (error) {
    console.error("[UPLOAD_ERROR]", error);
    return jsonError(
      error instanceof Error ? error.message : "Upload failed",
      500
    );
  }
}