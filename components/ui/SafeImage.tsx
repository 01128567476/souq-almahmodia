"use client";

import Image from "next/image";
import { cn } from "@/utils/cn";
import { getValidImage, getInitialFromName } from "@/lib/imageUtils";
import { Icon } from "@/components/ui/Icon";

/**
 * Fallback UI types for SafeImage component.
 * Determines the visual appearance of the placeholder.
 */
export type FallbackType = "avatar" | "product" | "default";

/**
 * SafeImage component that safely handles empty/null/undefined image sources.
 * 
 * Features:
 * - Validates src before rendering Image component
 * - Shows contextual fallback UI when src is invalid
 * - Supports loading skeleton for smooth transitions
 * - Responsive sizing via className
 * - Works with SSR (Next.js Image optimization)
 * 
 * @example
 * // Basic usage
 * <SafeImage src={user.avatar} alt={user.name} />
 * 
 * @example
 * // With fallback type
 * <SafeImage src={product.image} alt={product.title} fallbackType="product" />
 * 
 * @example
 * // With skeleton loading
 * <SafeImage src={user.avatar} alt={user.name} skeleton />
 */
export function SafeImage({
  src,
  alt = "",
  width,
  height,
  className,
  fallbackType = "default",
  skeleton = false,
  priority = false,
  quality = 75,
  ...restProps
}: {
  /** Image source URL. Can be null/undefined/empty string. */
  src?: string | null;
  /** Alt text for accessibility */
  alt?: string;
  /** Explicit width (optional when using fill or className) */
  width?: number;
  /** Explicit height (optional when using fill or className) */
  height?: number;
  /** Tailwind CSS classes for styling */
  className?: string;
  /** Type of fallback to display */
  fallbackType?: FallbackType;
  /** Show loading skeleton instead of fallback */
  skeleton?: boolean;
  /** Next.js Image priority prop */
  priority?: boolean;
  /** Next.js Image quality prop */
  quality?: number;
  /** Additional props to spread on the Image component */
  [key: string]: unknown;
}) {
  const validSrc = getValidImage(src);
  const hasName = restProps["data-name"] as string | undefined;
  const initial = getInitialFromName(hasName);

  // Fallback dimensions based on type
  const fallbackSize = fallbackType === "avatar" ? 40 : fallbackType === "product" ? 48 : 64;
  const fallbackClasses =
    fallbackType === "avatar"
      ? "rounded-full"
      : fallbackType === "product"
        ? "rounded-lg"
        : "rounded-lg";

  // Loading skeleton
  if (skeleton) {
    return (
      <div
        className={cn(
          "animate-pulse bg-surface-container",
          fallbackClasses,
          className ?? `h-[${fallbackSize}px] w-[${fallbackSize}px]`,
        )}
        style={width || height ? { width, height } : undefined}
        aria-hidden="true"
      />
    );
  }

  // No valid image - render fallback
  if (!validSrc) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-primary/15 text-primary font-bold",
          fallbackClasses,
          className,
          fallbackType === "avatar" && "text-label-sm",
          fallbackType === "product" && "text-body-sm",
        )}
        style={width || height ? { width, height } : undefined}
        role="img"
        aria-label={alt || "Image placeholder"}
      >
        {fallbackType === "avatar" ? (
          <span className="text-label-sm font-bold">{initial}</span>
        ) : fallbackType === "product" ? (
          <Icon name="image_not_supported" size={20} className="text-on-surface-variant" />
        ) : (
          <Icon name="image_not_supported" size={24} className="text-on-surface-variant" />
        )}
      </div>
    );
  }

  // Valid image - render with Next.js Image
  const hasFill = className?.includes("fill") || restProps["fill"] === true;

  if (hasFill) {
    return (
      <Image
        src={validSrc}
        alt={alt}
        fill
        quality={quality}
        priority={priority}
        className={className}
        {...restProps}
      />
    );
  }

  return (
    <Image
      src={validSrc}
      alt={alt}
      width={width}
      height={height}
      quality={quality}
      priority={priority}
      className={className}
      {...restProps}
    />
  );
}

/**
 * Wrapper for user avatars with smart defaults.
 * 
 * @example
 * <SafeAvatar src={user.avatar} name={user.name} width={40} height={40} />
 */
export function SafeAvatar({
  src,
  name,
  className,
  width = 40,
  height = 40,
  skeleton = false,
}: {
  src?: string | null;
  name?: string;
  className?: string;
  width?: number;
  height?: number;
  skeleton?: boolean;
}) {
  return (
    <SafeImage
      src={src}
      alt={name ?? "Avatar"}
      width={width}
      height={height}
      className={cn("shrink-0", className)}
      fallbackType="avatar"
      skeleton={skeleton}
      data-name={name}
    />
  );
}

/**
 * Wrapper for product/ad images with smart defaults.
 * 
 * @example
 * <SafeProductImage src={product.image} alt={product.title} />
 */
export function SafeProductImage({
  src,
  alt,
  className,
  width,
  height,
  fill = false,
  skeleton = false,
  quality = 75,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  skeleton?: boolean;
  quality?: number;
}) {
  if (fill) {
    return (
      <SafeImage
        src={src}
        alt={alt}
        fill
        className={cn("object-cover", className)}
        fallbackType="product"
        skeleton={skeleton}
        quality={quality}
      />
    );
  }

  return (
    <SafeImage
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={cn("object-cover", className)}
      fallbackType="product"
      skeleton={skeleton}
      quality={quality}
    />
  );
}