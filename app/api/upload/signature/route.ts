/**
 * Cloudinary Upload Signature Endpoint
 *
 * Generates a secure signature for direct browser → Cloudinary upload.
 * The API_SECRET is NEVER exposed to the client.
 *
 * Flow:
 * 1. Client calls this endpoint with auth cookie
 * 2. Server generates timestamped signature using API_SECRET
 * 3. Returns { cloudName, apiKey, timestamp, signature }
 * 4. Client uploads directly to Cloudinary using these params
 * 5. Cloudinary verifies the signature server-side
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/serverAuth";
import crypto from "crypto";

// Validate required env vars at runtime (fail fast in dev)
function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Missing Cloudinary environment variables");
  }

  return { cloudName, apiKey, apiSecret };
}

/**
 * Generate a Cloudinary upload signature.
 * Signature = SHA1(timestamp + API_SECRET)
 */
function generateSignature(timestamp: number, apiSecret: string): string {
  const stringToSign = `${timestamp}${apiSecret}`;
  return crypto.createHash("sha1").update(stringToSign).digest("hex");
}

export async function GET(request: Request) {
  try {
    // Require authentication — only logged-in users can upload
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
    const timestamp = Math.round(Date.now() / 1000);
    const signature = generateSignature(timestamp, apiSecret);

    return NextResponse.json({
      cloudName,
      apiKey,
      timestamp: String(timestamp),
      signature,
      folder: "souq-ads",
    });
  } catch (error) {
    console.error("[Upload Signature] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate upload signature" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  // Allow POST with same logic (for compatibility)
  return GET(request);
}