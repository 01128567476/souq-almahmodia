/**
 * Cloudinary SDK Configuration — Production Image Storage
 *
 * Initialized server-side only. API_SECRET is NEVER exposed to client.
 * All upload transformations applied automatically via upload preset.
 */

import { v2 as cloudinary } from "cloudinary";

if (!process.env.CLOUDINARY_CLOUD_NAME) {
  throw new Error("CLOUDINARY_CLOUD_NAME is not set");
}
if (!process.env.CLOUDINARY_API_KEY) {
  throw new Error("CLOUDINARY_API_KEY is not set");
}
if (!process.env.CLOUDINARY_API_SECRET) {
  throw new Error("CLOUDINARY_API_SECRET is not set");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Transform a Cloudinary URL to include optimization parameters.
 * Pattern: f_auto,q_auto,w_800
 */
export function optimizeCloudinaryUrl(url: string): string {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("cloudinary.com")) return url;

  // Insert transformation before the public_id section
  // Pattern: /image/upload/ -> /image/upload/f_auto,q_auto,w_800/
  return url.replace("/image/upload/", "/image/upload/f_auto,q_auto,w_800/");
}

/**
 * Extract public_id from a Cloudinary URL for deletion.
 * Returns null if URL is invalid or not from Cloudinary.
 */
export function extractPublicId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  if (!url.includes("cloudinary.com")) return null;

  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split("/");
    const uploadIndex = parts.indexOf("image");
    if (uploadIndex === -1 || uploadIndex + 1 >= parts.length) return null;

    // Get the path after /image/upload/
    const publicIdPath = parts.slice(uploadIndex + 2).join("/");
    return publicIdPath || null;
  } catch {
    return null;
  }
}

/**
 * Delete images from Cloudinary by URLs.
 * Returns array of deleted public IDs (for audit).
 */
export async function deleteImagesFromCloudinary(urls: string[]): Promise<string[]> {
  const deleted: string[] = [];

  for (const url of urls) {
    const publicId = extractPublicId(url);
    if (!publicId) continue;

    try {
      await new Promise<void>((resolve, reject) => {
        cloudinary.uploader.destroy(publicId, (error, result) => {
          if (error) {
            console.error(`[CLOUDINARY_DELETE] Failed to delete ${publicId}:`, error);
            reject(error);
          } else {
            deleted.push(publicId);
            resolve();
          }
        });
      });
    } catch (error) {
      console.error(`[CLOUDINARY_DELETE] Skipping failed deletion for ${publicId}:`, error);
    }
  }

  return deleted;
}

export default cloudinary;