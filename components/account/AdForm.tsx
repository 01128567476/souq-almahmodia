"use client";

import { useState, type FormEvent, useRef, useCallback } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { Icon } from "@/components/ui/Icon";
import { Field, TextAreaField, SelectField } from "@/components/ui/Field";
import { resolveCategoryName } from "@/utils/category";
import { cn } from "@/utils/cn";
import type { Category, Product } from "@/types";

type Mode = "create" | "edit";

// Placeholder image for failed loads
const PLACEHOLDER_IMAGE = "/placeholder-image.svg";

export function AdForm({
  mode,
  product,
  categories,
}: {
  mode: Mode;
  product?: Product;
  /** Selectable categories, fetched on the server and passed in. */
  categories: Category[];
}) {
  const t = useTranslations("ads");
  const locale = useLocale() as Locale;
  const router = useRouter();

  // Preview URLs (blob: for new files, cloudinary: for existing/uploaded)
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  // Per-image upload progress tracking
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  // Actual Cloudinary URLs to send to the API
  const [uploadedUrls, setUploadedUrls] = useState<string[]>(product?.images ?? []);
  const [title, setTitle] = useState(product?.title ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [category, setCategory] = useState(product?.categorySlug ?? "");
  const [phone, setPhone] = useState(product?.sellerPhone ?? "");
  const [location, setLocation] = useState(product?.location ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasSubmittedRef = useRef(false);

  /** Extract only numeric characters (including Arabic digits) from price input. */
  const normalizePriceInput = (value: string): string => {
    let converted = value
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
    const digitsOnly = converted.match(/[\d.,]+/g);
    return digitsOnly ? digitsOnly.join("").replace(/,/g, "") : "";
  };

  const categoryOptions = categories.map((c) => ({
    value: c.slug,
    label: resolveCategoryName(c, locale),
  }));

  // File input handler — uploads ONE BY ONE with per-image progress
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsUploading(true);

    // Track how many succeeded/failed
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      if (!file.type.startsWith("image/")) continue;

      // Unique key for this image progress
      const progressKey = `${Date.now()}-${i}`;

      // 1. SHOW IMAGE IMMEDIATELY (blob preview)
      const previewUrl = URL.createObjectURL(file);
      setImages((prev) => [...prev, previewUrl]);

      // 2. START PROGRESS
      setUploadProgress((prev) => ({ ...prev, [progressKey]: 10 }));

      try {
        // 3. UPLOAD TO SERVER (one file at a time)
        const formData = new FormData();
        formData.append("files", file);

        const res = await fetch("/api/upload/image", {
          method: "POST",
          body: formData,
        });

        // 4. JUMP PROGRESS AFTER RESPONSE
        setUploadProgress((prev) => ({ ...prev, [progressKey]: 70 }));

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Upload failed");
        }

        const data = await res.json();
        const url = data.urls?.[0];
        if (!url) throw new Error("No URL returned");

        // 5. SAVE REAL CLOUDINARY URL
        setUploadedUrls((prev) => [...prev, url]);
        successCount++;

        // 6. COMPLETE PROGRESS
        setUploadProgress((prev) => ({ ...prev, [progressKey]: 100 }));

      } catch (err) {
        console.error("[AdForm] Upload failed:", err);
        // Mark as failed
        setUploadProgress((prev) => ({ ...prev, [progressKey]: -1 }));
        failCount++;
      }
    }

    // Show summary error if any failed
    if (failCount > 0) {
      setSubmitError(`${failCount} image(s) failed to upload. ${successCount} succeeded.`);
    }

    setIsUploading(false);

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removePhoto = (index: number) => {
    setImages((prev) => {
      const removed = prev[index];
      if (removed.startsWith("blob:")) {
        URL.revokeObjectURL(removed);
      }
      // Also remove from uploadedUrls
      setUploadedUrls((prevUrls) => {
        const newUrls = prevUrls.filter((_: string, i: number) => i !== index);
        return newUrls;
      });
      return prev.filter((_, i: number) => i !== index);
    });
  };

  // Image load error handler — show placeholder
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    if (target.src !== PLACEHOLDER_IMAGE) {
      target.src = PLACEHOLDER_IMAGE;
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Prevent duplicate submissions
    if (hasSubmittedRef.current) return;

    // Check at least one image uploaded
    if (uploadedUrls.length === 0) {
      setSubmitError("Please upload at least one image first");
      return;
    }

    const next: Record<string, string> = {};
    if (images.length === 0) next.images = t("errImages");
    if (!title.trim()) next.title = t("errTitle");
    if (!description.trim()) next.description = t("errDescription");
    const normalizedPrice = normalizePriceInput(price);
    if (!normalizedPrice.trim() || Number(normalizedPrice) <= 0 || Number.isNaN(Number(normalizedPrice))) next.price = t("errPrice");
    if (!category) next.category = t("errCategory");
    if (!phone.trim()) next.phone = t("errPhone");
    setErrors(next);
    setSubmitError(null);

    if (Object.keys(next).length > 0) return;

    hasSubmittedRef.current = true;
    setIsSubmitting(true);

    try {
      // uploadedUrls contains all Cloudinary URLs from upload
      const imageUrls = uploadedUrls;

      const url = mode === "create" ? "/api/ads" : `/api/ads/${product?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          price: Number(normalizedPrice),
          currency: "SAR",
          categorySlug: category,
          sellerPhone: phone.trim(),
          location: location.trim() || "Your Location",
          images: imageUrls,
          image: imageUrls[0],
          condition: "excellent",
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to save advertisement";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // Fall back to default message
        }
        throw new Error(errorMessage);
      }

      const ad = await response.json();

      // Clear blob URLs to free memory
      images.forEach((img) => {
        if (img.startsWith("blob:")) {
          URL.revokeObjectURL(img);
        }
      });

      // Navigate on success
      if (mode === "create") {
        router.push(`/account/ads/success?id=${ad.id}`);
      } else {
        router.push(ROUTES.accountAds);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
      hasSubmittedRef.current = false;
    }
  };

  // Get progress value for image at index (matches uploadProgress keys to image indices)
  const getProgressForIndex = (index: number): number => {
    const progressKeys = Object.keys(uploadProgress);
    if (index >= progressKeys.length) return 0;
    return uploadProgress[progressKeys[index]] ?? 0;
  };

  return (
    <form onSubmit={onSubmit} className="space-y-lg" noValidate>
      {/* Image Upload */}
      <div className="space-y-xs">
        <span className="font-label-md text-label-md text-on-surface-variant block ms-xs">
          {t("images")}
        </span>
        <div className="flex flex-wrap gap-md">
          {images.map((src, i) => {
            const progress = getProgressForIndex(i);

            return (
              <div
                key={`${src}-${i}`}
                className="relative w-28 h-28 rounded-2xl overflow-hidden border border-outline-variant"
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="112px"
                  className="object-cover"
                  onError={handleImageError}
                  draggable={false}
                />

                {/* Progress overlay */}
                {progress > 0 && progress < 100 && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-gray-200">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}

                {/* Failed overlay */}
                {progress === -1 && (
                  <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">Failed</span>
                  </div>
                )}

                {/* Success indicator (100% = uploaded) */}
                {progress === 100 && (
                  <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white">
                    <Icon name="check" size={12} />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  aria-label={t("removePhoto")}
                  className="absolute top-1 end-1 w-7 h-7 rounded-full bg-scrim/60 text-white flex items-center justify-center hover:bg-scrim transition-colors disabled:opacity-50"
                  disabled={isSubmitting || isUploading}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            );
          })}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
          />

          <button
            type="button"
            onClick={triggerFileInput}
            disabled={isSubmitting || isUploading}
            className={cn(
              "w-28 h-28 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-xs text-on-surface-variant hover:border-primary hover:text-primary transition-colors",
              errors.images ? "border-error" : "border-outline-variant",
              (isSubmitting || isUploading) && "opacity-50 cursor-not-allowed"
            )}
          >
            <Icon name="add_a_photo" size={24} />
            <span className="text-label-md font-label-md">{t("addPhotos")}</span>
          </button>
        </div>

        {errors.images && (
          <p className="flex items-center gap-xs text-body-sm font-body-sm text-error ms-xs">
            <Icon name="error" size={16} />
            {errors.images}
          </p>
        )}
      </div>

      {/* Title */}
      <Field
        id="ad-title"
        label={t("title")}
        value={title}
        onChange={setTitle}
        placeholder={t("titlePlaceholder")}
        error={errors.title}
      />

      {/* Description */}
      <TextAreaField
        id="ad-description"
        label={t("description")}
        value={description}
        onChange={setDescription}
        placeholder={t("descriptionPlaceholder")}
        rows={5}
        error={errors.description}
      />

      {/* Price, Category, Location */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-lg">
        <Field
          id="ad-price"
          label={t("price")}
          value={price}
          onChange={setPrice}
          placeholder={t("pricePlaceholder")}
          inputMode="numeric"
          error={errors.price}
        />
        <SelectField
          id="ad-category"
          label={t("category")}
          value={category}
          onChange={setCategory}
          options={categoryOptions}
          placeholder={t("category")}
          error={errors.category}
        />
        <Field
          id="ad-location"
          label={t("location")}
          icon="location_on"
          value={location}
          onChange={setLocation}
          placeholder={t("locationPlaceholder")}
          error={errors.location}
        />
      </div>

      {/* Phone */}
      <Field
        id="ad-phone"
        label={t("phone")}
        icon="call"
        type="tel"
        value={phone}
        onChange={setPhone}
        placeholder={t("phonePlaceholder")}
        inputMode="tel"
        error={errors.phone}
      />

      {/* Submit Error */}
      {submitError && (
        <div className="p-lg rounded-xl bg-error-container/10 border border-error text-error">
          {submitError}
        </div>
      )}

      {/* Submit Buttons */}
      <div className="flex gap-md pt-sm">
        <button
          type="submit"
          disabled={isSubmitting || isUploading}
          className="flex items-center justify-center gap-sm py-md px-xl bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60 min-w-[200px]"
        >
          {isSubmitting ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-on-primary border-t-transparent" />
              {t("loading")}
            </>
          ) : isUploading ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-on-primary border-t-transparent" />
              {t("uploading")}
            </>
          ) : (
            <>
              <Icon name={mode === "create" ? "publish" : "save"} size={20} />
              {mode === "create" ? t("publish") : t("saveChanges")}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => router.push(ROUTES.accountAds)}
          disabled={isSubmitting}
          className="flex items-center justify-center gap-sm py-md px-lg border border-outline-variant rounded-xl font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-60"
        >
          {t("backToAds")}
        </button>
      </div>
    </form>
  );
}