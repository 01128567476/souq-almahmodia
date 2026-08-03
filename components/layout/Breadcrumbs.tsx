import { Link } from "@/i18n/routing";
import { Icon } from "@/components/ui/Icon";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-xs text-on-surface-variant font-label-md text-label-md mb-lg"
    >
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-xs">
            {item.href && !last ? (
              <Link href={item.href} className="hover:text-primary transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={last ? "text-on-surface" : undefined}>{item.label}</span>
            )}
            {!last && (
              <>
                <Icon name="chevron_left" size={16} className="rtl:inline hidden" />
                <Icon name="chevron_right" size={16} className="rtl:hidden" />
              </>
            )}
          </span>
        );
      })}
    </nav>
  );
}
