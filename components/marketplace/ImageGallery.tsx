"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { cn } from "@/utils/cn";

/** Ad image gallery: a primary image with selectable thumbnails below. */
export function ImageGallery({ images, alt }: { images: string[]; alt: string }) {
  const t = useTranslations();
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];

  return (
    <div className="flex flex-col gap-md">
      <div className="relative aspect-square rounded-3xl overflow-hidden bg-surface-container-low border border-outline-variant">
        <Image
          src={current}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
          priority
          onError={(e) => { e.currentTarget.src = "/placeholder-image.svg"; }}
        />
      </div>

      {images.length > 1 && (
        <div className="flex gap-sm">
          {images.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={t("product.viewImage", { number: i + 1 })}
              aria-current={i === active}
              className={cn(
                "relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-colors shrink-0",
                i === active ? "border-primary" : "border-outline-variant hover:border-outline",
              )}
            >
              <Image src={src} alt="" fill sizes="80px" className="object-cover" onError={(e) => { e.currentTarget.src = "/placeholder-image.svg"; }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
