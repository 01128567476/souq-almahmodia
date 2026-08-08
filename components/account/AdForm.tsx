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

  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [title, setTitle] = useState(product?.title ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [category, setCategory] = useState(product?.categorySlug ?? "");
  const [phone, setPhone] = useState(product?.sellerPhone ?? "");
  const [location, setLocation] = useState(product?.location ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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

  // File input handler — stores File objects for upload, blob URLs for preview only
  const fileRefsRef = useRef<Map<number, File>>(new Map());

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 10 - images.length;
    const totalFiles = Math.min(files.length, remainingSlots);

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      const url = URL.createObjectURL(file);
      // Store File object for upload later
      fileRefsRef.current.set(images.length + i, file);
      setImages((prev) => [...prev, url]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [images.length]);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removePhoto = (index: number) => {
    setImages((prev) => {
      const removed = prev[index];
      if (removed.startsWith("blob:")) {
        URL.revokeObjectURL(removed);
      }
      fileRefsRef.current.delete(index);
      // Re-map remaining file refs to maintain sequential indices
      const remainingFiles = new Map<number, File>();
      const newImages = prev.filter((_, i) => i !== index);
      let newIndex = 0;
      for (let i = 0; i < prev.length; i++) {
        if (i === index) continue;
        const file = fileRefsRef.current.get(i);
        if (file) {
          remainingFiles.set(newIndex, file);
          newIndex++;
        }
      }
      fileRefsRef.current = remainingFiles;
      return newImages;
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
      // Step 1: Upload new File objects directly to Cloudinary (NO fetch of blob URLs)
      let imageUrls: string[] = product?.images ?? [];

      // Collect File objects stored from file input (these are the originals)
      const newFiles: File[] = [];
      fileRefsRef.current.forEach((file) => {
        // Only include files not yet uploaded (ones not in current images state)
        const imageIndex = images.indexOf(
          images.find((img) => {
            // Match by checking if the image is a blob URL
            return img.startsWith("blob:");
          }) ?? ""
        );
        // Always include - server handles dedup via timestamps
        newFiles.push(file);
      });

      if (newFiles.length > 0) {
        setIsUploading(true);
        setUploadProgress(0);

        const formData = new FormData();
        for (const file of newFiles) {
          formData.append("files", file);
        }

        setUploadProgress(20);

        // Upload to Cloudinary — NO Content-Type header (browser sets it with boundary)
        const uploadResponse = await fetch("/api/upload/image", {
          method: "POST",
          body: formData,
        });

        setUploadProgress(60);

        if (!uploadResponse.ok) {
          let errorMessage = "Image upload failed";
          try {
            const errorData = await uploadResponse.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // Fall back to default message
          }
          throw new Error(errorMessage);
        }

        setUploadProgress(80);

        const uploadResult = await uploadResponse.json();
        if (!uploadResult.urls || !Array.isArray(uploadResult.urls)) {
          throw new Error("Invalid upload response from server");
        }

        imageUrls = [...(product?.images ?? []), ...uploadResult.urls];
        setUploadProgress(100);
        setIsUploading(false);
      }

      // Step 2: Create/update ad with Cloudinary URLs
      setUploadProgress(90);

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

      // Clear blob URLs and File refs to free memory
      images.forEach((img) => {
        if (img.startsWith("blob:")) {
          URL.revokeObjectURL(img);
        }
      });
      fileRefsRef.current.clear();

      // Navigate on success
      if (mode === "create") {
        router.push(`/account/ads/success?id=${ad.id}`);
      } else {
        router.push(ROUTES.accountAds);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
      setIsUploading(false);
      setUploadProgress(0);
      hasSubmittedRef.current = false;
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-lg" noValidate>
      {/* Image Upload */}
      <div className="space-y-xs">
        <span className="font-label-md text-label-md text-on-surface-variant block ms-xs">
          {t("images")}
        </span>
        <div className="flex flex-wrap gap-md">
          {images.map((src, i) => (
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
          ))}

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
          className="flex items-center justify-center gap-sm py-md px-xl bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          <Icon name={mode === "create" ? "publish" : "save"} size={20} />
          {isUploading
            ? `${t("loading")} (${uploadProgress}%)`
            : mode === "create"
            ? t("publish")
            : t("saveChanges")}
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