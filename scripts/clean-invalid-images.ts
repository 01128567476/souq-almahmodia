/**
 * DB Cleanup Script — Remove invalid image URLs from ad_images
 *
 * Runs: npx tsx scripts/clean-invalid-images.ts
 *
 * What it does:
 * 1. Scans ad_images table for blob:, data:, base64 URLs
 * 2. Deletes all invalid entries
 * 3. Ensures each ad has at least one primary image
 * 4. Logs before/after state
 *
 * IMPORTANT: This script modifies the database.
 */

import { db } from "@/lib/db-server";
import { products, adImages } from "@/drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { inArray } from "drizzle-orm";

const PLACEHOLDER_IMAGE = "/placeholder-image.svg";

async function main() {
  console.log("[CLEANUP] Starting invalid image cleanup...");
  console.log("");

  // Step 1: Find invalid entries in ad_images table
  console.log("[CLEANUP] Scanning ad_images table for invalid URLs...");

  const invalidAdImages = await db
    .select()
    .from(adImages)
    .where(
      sql`${adImages.imageUrl} LIKE '%blob:%' OR ${adImages.imageUrl} LIKE '%data:image%' OR ${adImages.imageUrl} LIKE '%base64%'`
    );

  console.log(`[CLEANUP] Found ${invalidAdImages.length} invalid entries in ad_images`);

  if (invalidAdImages.length > 0) {
    const invalidIds = invalidAdImages.map((img) => img.id);
    await db.delete(adImages).where(inArray(adImages.id, invalidIds));
    console.log(`[CLEANUP] ✅ Deleted ${invalidIds.length} invalid ad_images entries`);
  }

  // Step 2: Find ads with NO images (might have had only invalid ones)
  console.log("");
  console.log("[CLEANUP] Checking for ads with no images...");

  const allAds = await db.select().from(products);
  const allImages = await db.select().from(adImages);

  const adsByAdId = new Map<string, typeof adImages.$inferSelect[]>();
  for (const img of allImages) {
    const existing = adsByAdId.get(img.adId) ?? [];
    existing.push(img);
    adsByAdId.set(img.adId, existing);
  }

  const emptyAds: string[] = [];
  for (const ad of allAds) {
    const images = adsByAdId.get(ad.id) ?? [];
    if (images.length === 0) {
      emptyAds.push(ad.id);
    }
  }

  console.log(`[CLEANUP] Found ${emptyAds.length} ads with zero images`);

  if (emptyAds.length > 0) {
    // Create placeholder ad_image entries for empty ads
    const placeholderRecords = emptyAds.map((adId) => ({
      adId,
      imageUrl: PLACEHOLDER_IMAGE,
      sortOrder: 0,
      isPrimary: true,
    }));
    await db.insert(adImages).values(placeholderRecords);
    console.log(`[CLEANUP] ✅ Added placeholder images to ${emptyAds.length} ads`);
  }

  // Step 3b: Remove empty imageUrl entries from ad_images
  console.log("");
  console.log("[CLEANUP] Removing ad_images with empty imageUrl...");
  
  const emptyImageUrls = await db
    .select()
    .from(adImages)
    .where(sql`${adImages.imageUrl} = '' OR ${adImages.imageUrl} IS NULL`);

  if (emptyImageUrls.length > 0) {
    const emptyIds = emptyImageUrls.map((img) => img.id);
    await db.delete(adImages).where(inArray(adImages.id, emptyIds));
    console.log(`[CLEANUP] ✅ Deleted ${emptyIds.length} ad_images with empty/null imageUrl`);
  } else {
    console.log("[CLEANUP] No empty imageUrl entries found.");
  }

  // Step 4: Summary
  console.log("");
  console.log("═══════════════════════════════════════");
  console.log("[CLEANUP] ✅ Cleanup complete!");
  console.log(`  - Total ads scanned: ${allAds.length}`);
  console.log(`  - Invalid ad_images removed: ${invalidAdImages.length}`);
  console.log(`  - Ads with no images: ${emptyAds.length}`);
  console.log("═══════════════════════════════════════");
}

main().catch((err) => {
  console.error("[CLEANUP] ❌ Failed:", err);
  process.exit(1);
});