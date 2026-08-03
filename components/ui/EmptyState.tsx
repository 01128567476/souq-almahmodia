import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-2xl px-margin">
      <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-lg">
        <Icon name={icon} size={32} className="text-outline" />
      </div>
      <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">{title}</h3>
      {description && (
        <p className="text-body-md font-body-md text-on-surface-variant max-w-md mb-lg">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
