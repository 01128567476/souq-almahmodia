/**
 * Cloudinary upload with automatic retry and exponential backoff.
 *
 * - MAX_RETRIES: 3 attempts total
 * - Exponential backoff: 500ms → 1000ms → 2000ms
 * - Progress callback for real-time feedback
 * - Network-error aware (won't retry on 4xx client errors)
 */

// Cloudinary constants
const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1";

export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  timestamp: string;
  signature: string;
};

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 500;

/**
 * Upload a single file to Cloudinary with retry logic.
 * @returns The secure URL of the uploaded image
 */
export async function uploadToCloudinaryWithRetry(
  file: File,
  config: CloudinaryConfig,
  onProgress?: (progress: number) => void
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = await uploadToCloudinary(file, config, onProgress);
      return url;
    } catch (err) {
      lastError = err;

      // Don't retry 4xx errors (bad file, invalid signature, etc.)
      if (err instanceof Error && err.message.includes("400")) {
        throw err;
      }

      if (attempt < MAX_RETRIES) {
        // Exponential backoff
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(
          `[uploadRetry] Attempt ${attempt} failed for ${file.name}, retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Upload failed after ${MAX_RETRIES} attempts`);
}

/**
 * Perform the actual Cloudinary upload (single attempt).
 */
async function uploadToCloudinary(
  file: File,
  config: CloudinaryConfig,
  onProgress?: (progress: number) => void
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", config.apiKey);
  formData.append("timestamp", config.timestamp);
  formData.append("signature", config.signature);
  formData.append("folder", "souq-ads");

  // Use XMLHttpRequest for progress tracking
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 95); // reserve 5% for response
        onProgress(percent);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.secure_url) {
            onProgress?.(100);
            resolve(data.secure_url);
          } else {
            reject(new Error("No URL in Cloudinary response"));
          }
        } catch {
          reject(new Error("Invalid Cloudinary response"));
        }
      } else {
        let message = "Cloudinary upload failed";
        try {
          const errorData = JSON.parse(xhr.responseText);
          message = errorData.error?.message || message;
        } catch {
          // Fall back
        }
        reject(new Error(message));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    xhr.addEventListener("timeout", () => {
      reject(new Error("Upload timeout"));
    });

    xhr.open("POST", `${CLOUDINARY_UPLOAD_URL}/${config.cloudName}/image/upload`);
    xhr.timeout = 120_000; // 2 minutes max per file
    xhr.send(formData);
  });
}