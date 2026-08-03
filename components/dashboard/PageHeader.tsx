import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md mb-xl">
      <div>
        <h1 className="text-headline-lg font-headline-lg text-on-surface">{title}</h1>
        {subtitle && (
          <p className="text-body-md font-body-md text-on-surface-variant mt-sm">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-sm">{actions}</div>}
    </div>
  );
}
