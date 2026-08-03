"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/utils/cn";

const inputClasses =
  "w-full pe-md py-md bg-white border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-body-md text-body-md text-on-surface placeholder:text-gray-400 placeholder:font-body-md placeholder:text-body-md placeholder:text-gray-400";

interface BaseProps {
  id: string;
  label: string;
  error?: string;
  /** Leading icon; when set the control gets extra start padding to clear it. */
  icon?: string;
}

/** Labelled text/email/tel input with an optional leading icon and error text. */
export function Field({
  id,
  label,
  icon,
  error,
  value,
  onChange,
  type = "text",
  placeholder,
  inputMode,
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
}) {
  return (
    <FieldShell id={id} label={label} icon={icon} error={error}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={!!error}
        className={cn(inputClasses, icon ? "ps-xl" : "ps-md", error ? "border-error" : "border-outline-variant")}
      />
    </FieldShell>
  );
}

/** Labelled multi-line textarea with error text. */
export function TextAreaField({
  id,
  label,
  error,
  value,
  onChange,
  placeholder,
  rows = 4,
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <FieldShell id={id} label={label} error={error}>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        aria-invalid={!!error}
        className={cn(inputClasses, "ps-md resize-y", error ? "border-error" : "border-outline-variant")}
      />
    </FieldShell>
  );
}

/** Labelled select with error text. Options are `{ value, label }`. */
export function SelectField({
  id,
  label,
  error,
  value,
  onChange,
  options,
  placeholder,
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <FieldShell id={id} label={label} error={error}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={cn(inputClasses, "ps-md pe-xl appearance-none bg-white", error ? "border-error" : "border-outline-variant")}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/** Shared label + icon + error chrome around a control. */
function FieldShell({
  id,
  label,
  icon,
  error,
  children,
}: BaseProps & { children: ReactNode }) {
  return (
    <div className="space-y-xs">
      <label htmlFor={id} className="font-label-md text-label-md text-on-surface-variant block ms-xs">
        {label}
      </label>
      <div className="relative group">
        {icon && (
          <Icon
            name={icon}
            className="absolute start-md top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors z-10"
          />
        )}
        {children}
      </div>
      {error && (
        <p className="flex items-center gap-xs text-body-sm font-body-sm text-error ms-xs">
          <Icon name="error" size={16} />
          {error}
        </p>
      )}
    </div>
  );
}
