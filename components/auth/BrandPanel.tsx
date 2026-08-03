import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { Icon } from "@/components/ui/Icon";

/** Reused marketplace lifestyle shot */
const PANEL_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuB4omBcnaEnXt-rfBWnIzV41Dz-yC33na3Kv1TlHagcS-f0jzHXq1I9qFUqAapdphWRfR0IQPCjPOAVsRqWUWzMr_Vj_vYuDZ-dZ7bPwH4lNM5grEbRVfnAq8PJc44Wl7fWdZDTI16V4jmw7z0FADtURNhQc2GD7lQ5ZsyU-64K1wpOeuKBVQ_6vUYB5U9_SiaNIJSvfuP2SK1s5aCGJGFDPZyZvwGXa9pCT-WR9rCwgv3F13gEpz99";

/**
 * Right-side branding panel for the auth split-screen.
 * Modern, minimal design with gradient background, floating cards, and clean typography.
 */
export async function BrandPanel() {
  const t = await getTranslations();

  return (
    <div className="relative hidden lg:flex flex-col justify-between h-full overflow-hidden bg-gradient-to-br from-primary/5 via-primary-container/10 to-secondary-container/10 px-2xl py-xl">
      {/* Top section */}
      <div className="flex items-center gap-sm">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-on-primary shadow-lg shadow-primary/20">
          <Icon name="storefront" size={24} />
        </div>
        <span className="text-headline-md font-headline-md font-bold text-on-surface">
          {t("brand.name")}
        </span>
      </div>

      {/* Center content */}
      <div className="flex-1 flex flex-col justify-center max-w-[480px]">
        <h1 className="text-display-lg font-display-lg text-on-surface mb-4 leading-tight">
          {t("auth.panelTitle")}
        </h1>
        <p className="text-body-lg font-body-lg text-on-surface-variant mb-10 leading-relaxed">
          {t("auth.panelSubtitle")}
        </p>

        {/* Floating image card */}
        <div className="relative">
          <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border border-outline-variant/20">
            <Image
              src={PANEL_IMAGE}
              alt={t("brand.name")}
              fill
              sizes="45vw"
              className="object-cover"
              priority
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent" />
          </div>
          
          {/* Trust badge floating card */}
          <div className="absolute -bottom-5 -right-5 flex items-center gap-3 bg-white shadow-xl rounded-2xl px-5 py-3 border border-gray-100">
            <span className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary-container flex items-center justify-center text-primary shadow-sm">
              <Icon name="verified" size={22} />
            </span>
            <span className="text-label-lg font-label-md font-semibold text-on-surface uppercase tracking-wider">
              {t("auth.trustBadge")}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom section */}
      <p className="text-body-sm font-body-sm text-on-surface-variant/70">
        © 2024 {t("brand.name")}
      </p>
    </div>
  );
}