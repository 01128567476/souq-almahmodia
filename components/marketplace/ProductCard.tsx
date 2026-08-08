"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { REACTIONS, REACTION_BY_TYPE } from "@/constants/reactions";
import { Icon } from "@/components/ui/Icon";
import { EngagementStatsRow } from "@/components/engagement/EngagementStats";
import { useReactions } from "@/hooks/useReactions";
import { useFavorite } from "@/hooks/useFavorite";
import { formatPrice } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { Locale } from "@/i18n/routing";
import type { EngagementStats, Product, ReactionSummary, ReactionType } from "@/types";
import { PinBadge } from "@/components/marketplace/PinBadge";
import { SafeProductImage } from "@/components/ui/SafeImage";

export function ProductCard({
  product,
  stats,
  statsLoading = false,
  onStatsChange,
}: {
  product: Product;
  stats?: EngagementStats;
  statsLoading?: boolean;
  /** Report an optimistic stats change back to the grid's shared state. */
  onStatsChange?: (adId: string, patch: Partial<EngagementStats>) => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const reactT = useTranslations("reactions");

  // Reactions are owned here so the bar and the reaction counter share one
  // source of truth — a reaction updates both at once, with no extra fetch.
  const { summary, react, pending, isAuthenticated } = useReactions(product.id);

  const favorited = stats?.viewerHasFavorited ?? false;
  const favoriteCount = stats?.favorites ?? 0;
  const { toggle: toggleFavorite, pending: favoritePending } = useFavorite(
    product.id,
    favorited,
    favoriteCount,
    (patch) => onStatsChange?.(product.id, patch),
  );

  // Prefer the live reaction total so the counter tracks the bar instantly.
  const displayStats: EngagementStats | undefined = stats
    ? { ...stats, reactions: summary?.total ?? stats.reactions }
    : undefined;

  // Inline reaction trigger state (moved from ReactionBar component for compact layout).
  const [reactOpen, setReactOpen] = useState(false);
  const reactContainerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoverOpen = useRef(false); // Track if opened via hover (desktop) vs click (mobile)

  useEffect(() => {
    if (!reactOpen) return;
    const onDown = (e: MouseEvent) => {
      if (reactContainerRef.current && !reactContainerRef.current.contains(e.target as Node)) {
        setReactOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReactOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [reactOpen]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const openReactPicker = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    isHoverOpen.current = true;
    setReactOpen(true);
  };
  const closeReactPickerSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setReactOpen(false), 180);
  };

  const reactRequireAuth = (): boolean => {
    if (isAuthenticated) return true;
    router.push(`${ROUTES.login}?next=${encodeURIComponent(`/product/${product.id}`)}`);
    return false;
  };

  const reactPick = (type: ReactionType) => {
    setReactOpen(false);
    if (!reactRequireAuth()) return;
    react(type);
  };

  const reactOnTriggerClick = () => {
    if (!reactRequireAuth()) return;
    if (summary?.viewerReaction) {
      react(summary.viewerReaction);
    } else {
      setReactOpen((v) => !v);
    }
  };

  const reactActive = summary?.viewerReaction ?? null;
  const reactActiveConfig = reactActive ? REACTION_BY_TYPE[reactActive] : null;

  return (
    <div className="group bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col max-w-[calc(100%-3px)] mx-auto w-full">
      {/* Fixed-height image area — ~25-30% shorter than aspect-square, preserving rounded top corners
          Mobile (<640px): 150px | Tablet (640px+): 170px | Desktop (768px+): 190px */}
      <div className="relative overflow-hidden bg-surface-container-low h-[150px] sm:h-[170px] md:h-[190px]">
        <Link href={ROUTES.product(product.id)} className="block h-full w-full">
          <SafeProductImage
            src={product.image}
            alt={product.title}
            fill
            className="group-hover:scale-105 transition-transform duration-500"
          />
        </Link>
        {product.featured && (
          <span className="absolute top-4 start-4 bg-primary text-on-primary text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest pointer-events-none">
            {t("home.newArrivals")}
          </span>
        )}
        {/* Pin badge overlay */}
        <div className="absolute bottom-4 start-4 z-10">
          <PinBadge pinned={product.pinned === true} />
        </div>

        {/* Sibling of the Link (not a child), so a tap toggles the favorite
            instead of opening the ad. The rest of the image stays clickable. */}
        <button
          type="button"
          onClick={toggleFavorite}
          disabled={favoritePending}
          aria-pressed={favorited}
          aria-label={t(favorited ? "product.removeFromFavorites" : "product.addToFavorites")}
          className="absolute top-4 end-4 bg-white/80 backdrop-blur-sm size-9 rounded-full transition-colors hover:text-error disabled:opacity-60 overflow-hidden grid place-items-center"
        >
          <Icon
            name="favorite"
            size={20}
            className={cn(favorited ? "text-error" : "text-on-surface-variant")}
            style={favorited ? { fontVariationSettings: "'FILL' 1" } : undefined}
          />
        </button>
      </div>
      <div className="p-sm flex flex-col flex-1">
        <div className="flex items-center justify-between mb-xs sm:mb-sm">
          <span className="text-primary font-headline-md text-body-md font-bold">
            {formatPrice(product.price, product.currency, locale)}
          </span>
          <span className="text-on-surface-variant text-label-md font-label-md px-2 py-0.5 bg-surface-container rounded">
            {t(`product.${product.condition === "new" ? "brandNew" : product.condition}`)}
          </span>
        </div>
        <h3 className="font-headline-md text-body-md text-on-surface mb-xs sm:mb-sm line-clamp-2">
          <Link href={ROUTES.product(product.id)} className="hover:text-primary transition-colors">
            {product.title}
          </Link>
        </h3>
        <div className="mt-auto space-y-sm sm:space-y-md">
          <div className="flex items-center gap-sm text-on-surface-variant text-body-sm font-body-sm">
            <span className="flex items-center gap-xs">
              <Icon name="location_on" size={16} />
              {product.location}
            </span>
            <span className="flex items-center gap-xs">
              <Icon name="schedule" size={16} />
              {t("product.postedAgo", { hours: product.postedAgoHours })}
            </span>
          </div>

          {/* Compact engagement row: React button + stats on one row */}
          <div className="flex items-center justify-between gap-sm border-t border-outline-variant pt-sm">
            {/* React button on the start side (end in RTL) */}
            {/* 
              Only apply hover handlers on non-touch devices. 
              on mobile, hover is ignored so a tap only triggers the click handler.
            */}
            <div
              ref={reactContainerRef}
              className="relative shrink-0"
              onMouseEnter={(e) => {
                // Only open via hover on non-touch devices
                if (window.matchMedia('(hover: hover)').matches) {
                  openReactPicker();
                }
              }}
              onMouseLeave={(e) => {
                if (window.matchMedia('(hover: hover)').matches) {
                  closeReactPickerSoon();
                }
              }}
            >
              {/* Picker popover */}
              <div
                role="menu"
                aria-label={reactT("pick")}
                className={cn(
                  "absolute bottom-full start-0 mb-2 flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-lowest p-1 shadow-xl transition-all duration-150 origin-bottom",
                  reactOpen
                    ? "pointer-events-auto scale-100 opacity-100"
                    : "pointer-events-auto scale-90 opacity-0",
                )}
              >
                {REACTIONS.map((r, i) => (
                  <button
                    key={r.type}
                    type="button"
                    role="menuitemradio"
                    aria-checked={reactActive === r.type}
                    aria-label={reactT(r.labelKey)}
                    title={reactT(r.labelKey)}
                    onClick={() => reactPick(r.type)}
                    className={cn(
                      "grid h-10 w-10 place-items-center rounded-full text-2xl transition-transform duration-150 hover:-translate-y-1 hover:scale-125 motion-reduce:transform-none",
                      reactActive === r.type && "bg-primary-fixed",
                    )}
                    style={{ transitionDelay: reactOpen ? `${i * 25}ms` : "0ms" }}
                  >
                    <span className="leading-none">{r.emoji}</span>
                  </button>
                ))}
              </div>

              {/* Trigger button */}
              <button
                type="button"
                onClick={reactOnTriggerClick}
                aria-haspopup="menu"
                aria-expanded={reactOpen}
                disabled={pending}
                className={cn(
                  "flex items-center gap-xs rounded-full border px-md py-sm font-label-md text-label-md transition-colors disabled:opacity-60",
                  reactActiveConfig
                    ? "border-primary/40 bg-primary-fixed"
                    : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low",
                )}
              >
                {reactActiveConfig ? (
                  <>
                    <span className="text-base leading-none">{reactActiveConfig.emoji}</span>
                    <span className={reactActiveConfig.color}>{reactT(reactActiveConfig.labelKey)}</span>
                  </>
                ) : (
                  <>
                    <Icon name="thumb_up" size={18} className="text-on-surface-variant" />
                    <span className="text-on-surface-variant">{reactT("react")}</span>
                  </>
                )}
              </button>
            </div>

            {/* Engagement stats on the opposite side */}
            <EngagementStatsRow
              stats={displayStats}
              locale={locale}
              loading={statsLoading}
              only={["reactions", "comments", "favorites"]}
            />
          </div>

          <Link
            href={ROUTES.product(product.id)}
            className="block w-full text-center py-md bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold hover:brightness-110 active:scale-[0.98] transition-all"
          >
            {t("common.requestPurchase")}
          </Link>
        </div>
      </div>
    </div>
  );
}