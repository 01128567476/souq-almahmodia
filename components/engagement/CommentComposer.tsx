"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/utils/cn";

/**
 * Reusable comment input. Ultra-compact layout similar to Facebook/Instagram comments.
 * - Single-row textarea on mobile by default
 * - Minimal padding around input and buttons
 * - Buttons sit close to input (no empty space)
 */
export function CommentComposer({
  avatar,
  initialValue = "",
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
  pending = false,
  autoFocus = false,
  compact = false,
}: {
  avatar?: string;
  initialValue?: string;
  placeholder: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<boolean> | boolean;
  onCancel?: () => void;
  pending?: boolean;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("common");
  const [value, setValue] = useState(initialValue);
  const canSubmit = value.trim().length > 0 && !pending;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const ok = await onSubmit(value);
    if (ok) setValue("");
  };

  return (
    <form onSubmit={submit} className="flex gap-1.5 sm:gap-2 items-center w-full">
      {/* Avatar — hidden in compact mode */}
      {avatar && !compact && (
        <Image
          src={avatar}
          alt=""
          width={30}
          height={30}
          className="rounded-full object-cover shrink-0 flex-shrink-0"
        />
      )}
      {/* Textarea — takes remaining width, same row as button */}
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        rows={1}
        autoFocus={autoFocus}
        className={cn(
          "flex-1 min-w-0 resize-none rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 sm:px-3 sm:py-2 font-body-md text-body-md text-on-surface outline-none transition-all",
          "focus:border-primary focus:ring-1 focus:ring-primary/20",
          "placeholder:text-on-surface-variant/60",
          "max-h-[120px]",
        )}
      />
      {/* Submit button — same row as input */}
      <button
        type="submit"
        disabled={!canSubmit}
        className={cn(
          "shrink-0 flex-shrink-0 min-h-[36px] sm:min-h-[40px] flex items-center gap-1 rounded-lg px-3 py-1 sm:px-4 sm:py-1.5 font-label-md text-label-md font-bold transition-all touch-manipulation whitespace-nowrap",
          canSubmit
            ? "bg-primary text-on-primary hover:brightness-110 active:scale-95"
            : "cursor-not-allowed bg-surface-container text-on-surface-variant",
        )}
      >
        {pending ? <Icon name="progress_activity" size={16} className="animate-spin" /> : null}
        {submitLabel}
      </button>
    </form>
  );
}