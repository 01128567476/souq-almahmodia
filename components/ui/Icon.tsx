import { cn } from "@/utils/cn";

import type { CSSProperties } from "react";

interface IconProps {
  name: string;
  className?: string;
  /** Optical size in px, applied inline. */
  size?: number;
  style?: CSSProperties;
  "aria-hidden"?: boolean;
}

/** Material Symbols Outlined wrapper. */
export function Icon({ name, className, size, style, ...rest }: IconProps) {
  return (
    <span
      className={cn("material-symbols-outlined", className)}
      style={{ fontFamily: '"Material Symbols Outlined"', ...(size ? { fontSize: `${size}px` } : null), ...style }}
      aria-hidden={rest["aria-hidden"] ?? true}
    >
      {name}
    </span>
  );
}
