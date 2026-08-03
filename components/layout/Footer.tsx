import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { Icon } from "@/components/ui/Icon";

export function Footer() {
  const t = useTranslations();

  const marketplaceLinks = [
    { href: ROUTES.about, label: t("nav.about") },
    { href: ROUTES.search, label: t("nav.browse") },
  ];
  const legalLinks = [
    { href: ROUTES.privacy, label: t("nav.privacy") },
    { href: ROUTES.terms, label: t("nav.terms") },
  ];

  return (
    <footer className="bg-surface-container border-t border-outline-variant">
      <div className="w-full py-2xl px-margin flex flex-col md:flex-row justify-between items-start gap-lg max-w-7xl mx-auto">
        <div className="max-w-xs">
          <h2 className="text-headline-md font-headline-md text-on-surface mb-md">
            {t("brand.name")}
          </h2>
          <p className="text-body-sm font-body-sm text-on-surface-variant mb-lg">
            {t("brand.tagline")}
          </p>
          <div className="flex gap-md">
            {["public", "camera", "share"].map((icon) => (
              <a
                key={icon}
                href="#"
                aria-label={icon}
                className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface hover:bg-primary hover:text-white transition-all"
              >
                <Icon name={icon} size={18} />
              </a>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-xl">
          <div className="flex flex-col gap-sm">
            <span className="font-bold text-on-surface mb-2">{t("nav.marketplace")}</span>
            {marketplaceLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-body-sm font-body-sm text-on-surface-variant hover:text-primary transition-all"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-sm">
            <span className="font-bold text-on-surface mb-2">{t("nav.legal")}</span>
            {legalLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-body-sm font-body-sm text-on-surface-variant hover:text-primary transition-all"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-outline-variant py-lg px-margin">
        <p className="max-w-7xl mx-auto text-body-sm font-body-sm text-on-surface-variant">
          © {new Date().getFullYear()} {t("brand.name")}. {t("footer.rights")}
        </p>
      </div>
    </footer>
  );
}
