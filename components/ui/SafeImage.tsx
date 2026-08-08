/**
 * SafeImage — Next.js Image with guaranteed fallback
 *
 * Components:
 * - SafeImage: general purpose wrapped <Image>
 * - SafeProductImage: for ad/product images (supports fill)
 * - SafeAvatar: for user avatars (supports w/h)
 *
 * All components:
 * - Automatically fall back to placeholder on load error
 * - Handle empty/null/invalid src values
 * - Reject blob:, data: URLs
 */

"use client";

import Image from "next/image";
import { useState } from "react";
import type { ImageProps } from "next/image";

const PLACEHOLDER = "/placeholder-image.svg";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Return placeholder if src is empty, null, or invalid. */
function sanitizeSrc(src: string | undefined | null): string {
  if (!src) return PLACEHOLDER;
  if (src.startsWith("blob:") || src.startsWith("data:")) return PLACEHOLDER;
  return src;
}

/** Avatar initials generator — returns first letter of name. */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
}

/** Avatar color based on name hash — deterministic per user. */
function getAvatarColor(name: string): string {
  const colors = [
    "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
    "#ec4899", "#f43f5e", "#ef4444", "#f97316",
    "#eab308", "#84cc16", "#22c55e", "#14b8a6",
    "#06b6d4", "#0ea5e9", "#3b82f6",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/* ------------------------------------------------------------------ */
/* SafeImage                                                          */
/* ------------------------------------------------------------------ */

export function SafeImage({
  src,
  alt,
  onError: externalOnError,
  ...props
}: ImageProps & { src?: string }) {
  const [failed, setFailed] = useState(false);

  const effectiveSrc = failed ? PLACEHOLDER : sanitizeSrc(src);

  const handleError: ImageProps["onError"] = (e) => {
    setFailed(true);
    externalOnError?.(e);
  };

  return (
    <Image
      {...props}
      src={effectiveSrc}
      alt={alt}
      onError={handleError}
    />
  );
}

/* ------------------------------------------------------------------ */
/* SafeProductImage — for ad/product images                           */
/* ------------------------------------------------------------------ */

export function SafeProductImage({
  src,
  alt,
  onError: externalOnError,
  ...props
}: ImageProps & { src?: string }) {
  const [failed, setFailed] = useState(false);

  const effectiveSrc = failed ? PLACEHOLDER : sanitizeSrc(src);

  const handleError: ImageProps["onError"] = (e) => {
    setFailed(true);
    externalOnError?.(e);
  };

  return (
    <Image
      {...props}
      src={effectiveSrc}
      alt={alt}
      onError={handleError}
    />
  );
}

/* ------------------------------------------------------------------ */
/* SafeAvatar — user avatar with initials fallback                    */
/* ------------------------------------------------------------------ */

export function SafeAvatar({
  src,
  name,
  width = 40,
  height = 40,
  className = "",
  onError: externalOnError,
}: {
  src?: string;
  name: string;
  width?: number;
  height?: number;
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}) {
  const [failed, setFailed] = useState(false);

  const effectiveSrc = failed ? null : sanitizeSrc(src);
  const initials = getInitials(name);
  const color = getAvatarColor(name);

  if (!effectiveSrc) {
    // Fallback: colored circle with initials
    return (
      <div
        className={`grid place-items-center rounded-full text-white font-semibold select-none ${className}`}
        style={{
          width,
          height,
          backgroundColor: color,
          fontSize: Math.min(width, height) * 0.35,
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <Image
      src={effectiveSrc}
      alt={name}
      width={width}
      height={height}
      className={`rounded-full object-cover ${className}`}
      onError={(e) => {
        setFailed(true);
        externalOnError?.(e);
      }}
    />
  );
}