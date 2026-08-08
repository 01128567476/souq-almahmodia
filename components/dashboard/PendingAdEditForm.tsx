"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { Field, SelectField, TextAreaField } from "@/components/ui/Field";
import { resolveCategoryName } from "@/utils/category";
import type { Category, Product } from "@/types";
import type { Locale } from "@/i18n/routing";

const SAMPLE_IMAGES = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCyRJVKbNhOzcwreg7BQI4BPNJSyU6G9Jpn9iGDGVfMxiD_qdWCYflr_3L2uH9AeIJ-04uguC6TjIGXuwQ-lUK9HKP53SxQZEpeIvJca4uBydXHba9vYTQrfHvEHo4ehm38UOFP7NBbZf5L5t2TKUMI8sA3Vjmm2Jq0GFYjay4TZwS1WEVBN",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCW0K9FrOAmm7gf1QzwscgR2w9SD-aJKa2kPS8VayZyHUSEnnTPNWGcT4p54rLdR9pbENwcAIZpSxQ-edSVkamasvjRhcjQR-sQrmHEdSQAohdl9u06U1UTFWyUYU2mGhdNCf82UutK5acuWpzu",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBTW8MmvpVukPXAB1OAdSbPXbIT35uBNtfPUNPOCcV4Tk4j1k-Ofp3nkNJMxMrjkuv03NrtLcUKCMD4bs9jTAp3Ika6lyaBydQ6zZ6SGygdThBbQYTh_0trMvbNRD9ETR6aQLF16wRFsrn",
];

export function PendingAdEditForm({
  ad,
  categories,
  onSave,
  onCancel,
}: {
  ad: Product;
  categories: Category[];
  onSave: (patch: {
    title: string;
    description: string;
    price: number;
    categorySlug: string;
    sellerPhone: string;
    location: string;
    images: string[];
    image: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;

  const [images, setImages] = useState<string[]>(ad.images?.length ? ad.images : [ad.image]);
  const [title, setTitle] = useState(ad.title);
  const [description, setDescription] = useState(ad.description ?? "");
  const [price, setPrice] = useState(String(ad.price));
  const [category, setCategory] = useState(ad.categorySlug);
  const [phone, setPhone] = useState(ad.sellerPhone);
  const [location, setLocation] = useState(ad.location);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

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

  const addPhoto = () => {
    const next = SAMPLE_IMAGES[images.length % SAMPLE_IMAGES.length];
    setImages((prev) => [...prev, next]);
  };

  const removePhoto = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (images.length === 0) nextErrors.images = t("ads.errImages");
    if (!title.trim()) nextErrors.title = t("ads.errTitle");
    if (!description.trim()) nextErrors.description = t("ads.errDescription");
    const normalizedPrice = normalizePriceInput(price);
    if (!normalizedPrice.trim() || Number(normalizedPrice) <= 0 || Number.isNaN(Number(normalizedPrice))) nextErrors.price = t("ads.errPrice");
    if (!category) nextErrors.category = t("ads.errCategory");
    if (!phone.trim()) nextErrors.phone = t("ads.errPhone");
    if (!location.trim()) nextErrors.location = t("ads.errLocation") as string;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        price: Number(normalizedPrice),
        categorySlug: category,
        sellerPhone: phone.trim(),
        location: location.trim(),
        images,
        image: images[0],
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-lg rounded-3xl border border-outline-variant bg-surface-container p-lg">
      <div className="space-y-xs">
        <span className="font-label-md text-label-md text-on-surface-variant block ms-xs">{t("ads.images")}</span>
        <div className="flex flex-wrap gap-md">
          {images.map((src, index) => (
            <div key={`${src}-${index}`} className="relative w-28 h-28 rounded-2xl overflow-hidden border border-outline-variant">
              <Image src={src} alt="" fill sizes="112px" className="object-cover" onError={(e) => { e.currentTarget.src = "/placeholder-image.svg"; }} />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                aria-label={t("ads.removePhoto")}
                className="absolute top-1 end-1 w-7 h-7 rounded-full bg-scrim/60 text-white flex items-center justify-center hover:bg-scrim transition-colors"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addPhoto}
            className="w-28 h-28 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-xs text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
          >
            <Icon name="add_a_photo" size={24} />
            <span className="text-label-md font-label-md">{t("ads.addPhotos")}</span>
          </button>
        </div>
        {errors.images && <p className="flex items-center gap-xs text-body-sm font-body-sm text-error ms-xs"><Icon name="error" size={16} />{errors.images}</p>}
      </div>

      <Field id="pending-ad-title" label={t("ads.title")} value={title} onChange={setTitle} placeholder={t("ads.titlePlaceholder")} error={errors.title} />
      <TextAreaField id="pending-ad-description" label={t("ads.description")} value={description} onChange={setDescription} placeholder={t("ads.descriptionPlaceholder")} rows={5} error={errors.description} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-lg">
        <Field id="pending-ad-price" label={t("ads.price")} value={price} onChange={setPrice} placeholder={t("ads.pricePlaceholder")} inputMode="numeric" error={errors.price} />
        <SelectField id="pending-ad-category" label={t("ads.category")} value={category} onChange={setCategory} options={categoryOptions} placeholder={t("ads.category")} error={errors.category} />
      </div>

      <Field id="pending-ad-phone" label={t("ads.phone")} icon="call" value={phone} onChange={setPhone} placeholder={t("ads.phonePlaceholder")} inputMode="tel" error={errors.phone} />
      <Field id="pending-ad-location" label={t("ads.location")} value={location} onChange={setLocation} placeholder={t("ads.locationPlaceholder") ?? ""} error={errors.location} />

      <div className="flex flex-wrap gap-md pt-sm">
        <button type="submit" disabled={saving} className="flex items-center justify-center gap-sm py-md px-xl bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60">
          <Icon name="save" size={20} />
          {t("ads.saveChanges")}
        </button>
        <button type="button" onClick={onCancel} className="flex items-center justify-center gap-sm py-md px-lg border border-outline-variant rounded-xl font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors">
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
