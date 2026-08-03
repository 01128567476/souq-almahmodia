/**
 * OTP Input Component
 * 
 * 6-digit verification code input with auto-focus, auto-move, paste support.
 * Production-quality, fully responsive, accessible, and backend-ready.
 * 
 * Features:
 * - Auto focus on mount / first input
 * - Auto move to next field on input
 * - Backspace returns to previous field
 * - Arrow key navigation (left/right)
 * - Paste complete code (numeric only)
 * - Mobile keyboard optimization (numeric keypad)
 * - Full accessibility (ARIA labels, focus indicators, screen reader support)
 * - Responsive sizing for all screen sizes (320px - 1440px+)
 * - Error state with visual feedback
 * - Disabled state
 * - Direction-aware (LTR for OTP digits)
 */

"use client";

import { useState, useRef, useCallback, useEffect, memo } from "react";
import { cn } from "@/utils/cn";

interface OTPInputProps {
  /** Number of digits (default: 6) */
  length?: number;
  /** Called whenever the code changes */
  onChange: (code: string) => void;
  /** Called when all digits are filled */
  onComplete?: (code: string) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Error state — shows red border */
  error?: boolean;
  /** Auto-focus first input on mount */
  autoFocus?: boolean;
  /** Custom aria-label for accessibility */
  ariaLabel?: string;
  /** Additional className for the container */
  className?: string;
  /** HTML id attribute for the first input element */
  id?: string;
}

export const OTPInput = memo(function OTPInput({
  length = 6,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = true,
  ariaLabel,
  className,
  id,
}: OTPInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const hasInteracted = useRef(false);

  // Focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, length]);

  const updateDigits = useCallback(
    (newDigits: string[]) => {
      setDigits(newDigits);
      const code = newDigits.join("");
      onChange(code);
      if (code.length === length && onComplete) {
        onComplete(code);
      }
    },
    [length, onComplete, onChange]
  );

  const handleChange = useCallback(
    (index: number, value: string) => {
      // Only allow digits
      if (!/^\d*$/.test(value)) return;

      hasInteracted.current = true;
      const newDigits = [...digits];
      newDigits[index] = value.slice(-1);
      updateDigits(newDigits);

      // Auto-focus next input
      if (value && index < length - 1 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits, length, updateDigits]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        const newDigits = [...digits];
        if (newDigits[index]) {
          newDigits[index] = "";
          updateDigits(newDigits);
        } else if (index > 0 && inputRefs.current[index - 1]) {
          inputRefs.current[index - 1]?.focus();
          const prevDigits = [...digits];
          prevDigits[index - 1] = "";
          updateDigits(prevDigits);
        }
      } else if (e.key === "ArrowLeft" && index > 0 && inputRefs.current[index - 1]) {
        e.preventDefault();
        inputRefs.current[index - 1]?.focus();
      } else if (
        e.key === "ArrowRight" &&
        index < length - 1 &&
        inputRefs.current[index + 1]
      ) {
        e.preventDefault();
        inputRefs.current[index + 1]?.focus();
      } else if (e.key === "Delete") {
        e.preventDefault();
        const newDigits = [...digits];
        newDigits[index] = "";
        updateDigits(newDigits);
      }
    },
    [digits, length, updateDigits]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pastedData = e.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, length);

      if (!pastedData) return;

      hasInteracted.current = true;
      const newDigits = [...digits];
      for (let i = 0; i < pastedData.length; i++) {
        newDigits[i] = pastedData[i];
      }
      updateDigits(newDigits);

      // Focus the next empty input or last input
      const focusIndex = Math.min(pastedData.length, length - 1);
      if (inputRefs.current[focusIndex]) {
        inputRefs.current[focusIndex]?.focus();
      }
    },
    [digits, length, updateDigits]
  );

  const handleFocus = useCallback((index: number) => {
    inputRefs.current[index]?.select();
  }, []);

  const handleBlur = useCallback((index: number) => {
    // Keep focus unless user explicitly moves away
  }, []);

  return (
    <div
      className={cn("flex gap-1.5 sm:gap-2 justify-center", className)}
      dir="ltr"
      role="group"
      aria-label={ariaLabel || "Verification code input"}
    >
      {digits.map((digit, index) => {
        const isActive = digit !== "";
        const isError = error;

        return (
          <input
            key={index}
            id={index === 0 && id ? `${id}-${index}` : undefined}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={() => handleFocus(index)}
            onBlur={() => handleBlur(index)}
            disabled={disabled}
            aria-label={`Digit ${index + 1} of ${length}`}
            aria-invalid={isError}
            aria-required="true"
            className={cn(
              // Base styles — responsive sizing
              "border rounded-xl transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:border-primary",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200",

              // Responsive dimensions — 320px to 1440px+
              // xs (320-360px): w-9 h-11 text-base
              // sm (360-768px): w-10 h-12 text-lg
              // md (768-1024px): w-11 h-[3.25rem] text-xl
              // lg (1024-1280px): w-12 h-14 text-2xl
              // xl+ (1280px+): w-[3.25rem] h-14 text-2xl
              // 2xl+ (1536px+): w-14 h-16 text-2xl
              "w-9 h-11 sm:w-10 sm:h-12 md:w-11 md:h-[3.25rem] lg:w-12 lg:h-14 xl:w-[3.25rem] xl:h-14 2xl:w-14 2xl:h-16",
              "text-base sm:text-lg md:text-xl lg:text-2xl",

              // Font weight
              "font-bold text-center tabular-nums",

              // Text color
              "text-gray-900",

              // Default state
              cn(
                "border-gray-200 bg-white",
                "hover:border-gray-300 hover:bg-gray-50/50",
                !isActive && !isError && "focus:ring-primary/20 focus:border-primary"
              ),

              // Active (filled) state
              cn(
                isActive &&
                  "border-primary bg-primary/5 focus:ring-primary/30 focus:border-primary"
              ),

              // Error state
              cn(
                isError &&
                  "border-red-300 bg-red-50/50 focus:ring-red-200 focus:border-red-500 hover:border-red-300"
              )
            )}
          />
        );
      })}
    </div>
  );
});

OTPInput.displayName = "OTPInput";