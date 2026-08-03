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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  /** Extract only numeric characters (including Arabic digits) from price input. */
  const normalizePriceInput = (value: string): string => {
    // First convert all Arabic-style digits to Western digits
    let converted = value
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
    // Extract only digits and decimal point, removing all text (Arabic, English, symbols)
    const digitsOnly = converted.match(/[\d.,]+/g);
    return digitsOnly ? digitsOnly.join("").replace(/,/g, "") : "";
  };

  const categoryOptions = categories.map((c) => ({
    value: c.slug,
    label: resolveCategoryName(c, locale),
  }));

  // Convert blob URL to Base64 string
  const blobToBase64 = (blobUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img: HTMLImageElement = document.createElement("img") as HTMLImageElement;
      (img as any).crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas") as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context not available"));
          return;
        }
        canvas.width = (img as HTMLImageElement).naturalWidth;
        canvas.height = (img as HTMLImageElement).naturalHeight;
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = blobUrl;
    });
  };

  // Real file upload handler
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const totalFiles = Math.min(files.length, 5 - images.length); // Max 5 images

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      const url = URL.createObjectURL(file);
      setImages((prev) => [...prev, url]);
    }

    // Reset file input so same file can be selected again
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
      // Revoke object URL to free memory
      if (removed.startsWith("blob:")) {
        URL.revokeObjectURL(removed);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (images.length === 0) next.images = t("errImages");
    if (!title.trim()) next.title = t("errTitle");
    if (!description.trim()) next.description = t("errDescription");
    const normalizedPrice = normalizePriceInput(price);
    if (!normalizedPrice.trim() || Number(normalizedPrice) <= 0 || Number.isNaN(Number(normalizedPrice))) next.price = t("errPrice");
    if (!category) next.category = t("errCategory");
    if (!phone.trim()) next.phone = t("errPhone");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setIsSubmitting(true);
    setUploadProgress(0);
    try {
      // Convert blob URLs to Base64 strings for submission
      const base64Images: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.startsWith("blob:")) {
          try {
            const base64 = await blobToBase64(img);
            base64Images.push(base64);
          } catch {
            // Skip images that fail to convert
            console.warn(`Failed to convert image ${i} to Base64`);
          }
        } else {
          // Already a valid URL (e.g., from edit mode)
          base64Images.push(img);
        }
        setUploadProgress(Math.round(((i + 1) / images.length) * 100));
      }

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
          images: base64Images,
          image: base64Images[0],
          condition: "excellent",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to save advertisement");
      }
      
      const ad = await response.json();
      
      // Clear blob URLs to free memory
      images.forEach((img) => {
        if (img.startsWith("blob:")) {
          URL.revokeObjectURL(img);
        }
      });

      // On create, show success page instead of redirecting to public
      if (mode === "create") {
        router.push(`/account/ads/success?id=${ad.id}`);
      } else {
        router.push(ROUTES.accountAds);
      }
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : "An error occurred" });
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-lg" noValidate>
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
              <Image src={src} alt="" fill sizes="112px" className="object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                aria-label={t("removePhoto")}
                className="absolute top-1 end-1 w-7 h-7 rounded-full bg-scrim/60 text-white flex items-center justify-center hover:bg-scrim transition-colors"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
          {/* Hidden file input for real file upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={triggerFileInput}
            className={cn(
              "w-28 h-28 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-xs text-on-surface-variant hover:border-primary hover:text-primary transition-colors",
              errors.images ? "border-error" : "border-outline-variant",
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

      <Field
        id="ad-title"
        label={t("title")}
        value={title}
        onChange={setTitle}
        placeholder={t("titlePlaceholder")}
        error={errors.title}
      />

      <TextAreaField
        id="ad-description"
        label={t("description")}
        value={description}
        onChange={setDescription}
        placeholder={t("descriptionPlaceholder")}
        rows={5}
        error={errors.description}
      />

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

      <div className="flex gap-md pt-sm">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center justify-center gap-sm py-md px-xl bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          <Icon name={mode === "create" ? "publish" : "save"} size={20} />
          {isSubmitting ? t("loading") : (mode === "create" ? t("publish") : t("saveChanges"))}
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
      {errors.submit && (
        <div className="p-lg rounded-xl bg-error-container/10 border border-error text-error">
          {errors.submit}
        </div>
      )}
    </form>
  );
}
