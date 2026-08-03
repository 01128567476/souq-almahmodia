import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

type Tone = "primary" | "secondary" | "success" | "warning" | "error" | "neutral";

const tones: Record<Tone, string> = {
  primary: "bg-primary-fixed text-on-primary-fixed",
  secondary: "bg-secondary-container text-on-secondary-container",
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  error: "bg-error-container text-on-error-container",
  neutral: "bg-surface-container text-on-surface-variant",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-label-md font-label-md",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
