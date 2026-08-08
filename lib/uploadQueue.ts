/**
 * Production-grade upload queue with:
 * - Controlled concurrency (max 3 parallel)
 * - Automatic retry with exponential backoff (3 attempts)
 * - Per-file progress tracking
 * - Stable performance under load
 */

import { uploadToCloudinaryWithRetry, type CloudinaryConfig } from "./uploadRetry";

export type UploadStatus = "pending" | "uploading" | "success" | "failed";

export type UploadItem = {
  file: File;
  status: UploadStatus;
  progress: number; // 0-100
  error?: string;
  url?: string;
};

export class UploadQueue {
  private queue: Array<{
    file: File;
    item: UploadItem;
    resolve: (url: string) => void;
    reject: (err: unknown) => void;
  }>;
  private activeCount = 0;
  private readonly concurrency: number;

  constructor(options?: { concurrency?: number }) {
    this.queue = [];
    this.concurrency = options?.concurrency ?? 3; // max parallel uploads
  }

  /**
   * Add a file to the upload queue and return a promise for its URL.
   * Returns an UploadItem for per-file status tracking.
   */
  add(file: File, config: CloudinaryConfig): {
    promise: Promise<string>;
    item: UploadItem;
  } {
    const item: UploadItem = {
      file,
      status: "pending",
      progress: 0,
    };

    const promise = new Promise<string>((resolve, reject) => {
      this.queue.push({ file, item, resolve, reject });
    });

    this.processNext(config);
    return { promise, item };
  }

  /**
   * Process queued uploads up to concurrency limit.
   */
  private processNext(config: CloudinaryConfig) {
    if (this.activeCount >= this.concurrency) return;
    if (this.queue.length === 0) return;

    const task = this.queue.shift();
    if (!task) return;

    this.activeCount++;
    task.item.status = "uploading";
    task.item.progress = 5; // initial progress

    uploadToCloudinaryWithRetry(
      task.file,
      config,
      (progress: number) => {
        task.item.progress = Math.max(task.item.progress, progress);
      }
    )
      .then((url: string) => {
        task.item.status = "success";
        task.item.url = url;
        task.item.progress = 100;
        task.resolve(url);
      })
      .catch((err: unknown) => {
        task.item.status = "failed";
        task.item.error =
          err instanceof Error ? err.message : "Upload failed";
        task.reject(err);
      })
      .finally(() => {
        this.activeCount--;
        // Process next queued item
        this.processNext(config);
      });
  }

  /**
   * Get current queue stats.
   */
  getStats() {
    return {
      pending: this.queue.length,
      active: this.activeCount,
      maxConcurrency: this.concurrency,
    };
  }
}