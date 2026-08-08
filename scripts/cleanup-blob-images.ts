/**
 * Cleanup Script: Remove/replace blob: and base64 URLs from ad_images table.
 *
 * This script should be run ONCE to clean up old invalid image references.
 *
 * Usage:
 *   npx tsx scripts/cleanup-blob-images.ts
 *
 * What it does:
 * 1. Finds all ad_images with blob: or data:image URLs
 * 2. Replaces them with placeholder URL
 * 3. Prints summary of changes
 */

import { db } from "@/lib/db-server";
import { adImages } from "@/drizzle/schema/tables";
import { eq } from "drizzle-orm";

const PLACEHOLDER_URL = "/placeholder-image.svg";

function isInvalidUrl(url: string): boolean {
  return url.startsWith("blob:") || url.startsWith("data:image");
}

function cleanImageUrl(url: string): string {
  return isInvalidUrl(url) ? PLACEHOLDER_URL : url;
}

export async function cleanupBlobImages() {
  console.log("[CLEANUP] Fetching all ad_images...");

  const allImages = await db.select().from(adImages);

  let updated = 0;
  let skipped = 0;

  for (const img of allImages) {
    const cleanUrl = cleanImageUrl(img.imageUrl);

    if (cleanUrl !== img.imageUrl) {
      await db
        .update(adImages)
        .set({ imageUrl: cleanUrl })
        .where(eq(adImages.id, img.id));

      updated++;
      console.log(
        `  [UPDATED] ad_image ${img.id}: imageUrl="${cleanUrl}"`
      );
    } else {
      skipped++;
    }
  }

  console.log("\n[CLEANUP COMPLETE]");
  console.log(`  Updated: ${updated} images`);
  console.log(`  Skipped (no changes): ${skipped} images`);
  console.log(`  Total processed: ${allImages.length} images`);
}

// Run if executed directly
if (require.main === module) {
  cleanupBlobImages()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("[CLEANUP ERROR]", error);
      process.exit(1);
    });
}

export {};