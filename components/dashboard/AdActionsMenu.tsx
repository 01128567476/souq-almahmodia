"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@/i18n/routing";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/utils/cn";

export type AdActionVariant = "default" | "danger";

export interface AdActionItem {
  key: string;
  label: string;
  /** Material Symbols icon name. */
  icon: string;
  /** Button items. Ignored when `href` is set. */
  onClick?: () => void;
  /** Link items (e.g. View) navigate instead of firing onClick. */
  href?: string;
  variant?: AdActionVariant;
  disabled?: boolean;
  /** Render a divider above this item (e.g. to separate Delete). */
  dividerBefore?: boolean;
}

const MENU_WIDTH = 224; // w-56
const MARGIN = 8; // keep this far from any viewport edge
const GAP = 6; // space between trigger and menu

type Placement = "bottom" | "top";

interface MenuPosition {
  top: number;
  left: number;
  placement: Placement;
}

// useLayoutEffect warns during SSR; fall back to useEffect on the server.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Reusable dashboard row-action menu: a single ⋮ trigger that opens a floating,
 * viewport-aware dropdown. Rendered through a portal with `position: fixed` so it is
 * never clipped by scrolling ancestors (e.g. the ads table's `overflow-x-auto`).
 */
export function AdActionsMenu({ items, label }: { items: AdActionItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false); // drives the enter animation
  const [pos, setPos] = useState<MenuPosition>({ top: 0, left: 0, placement: "bottom" });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | HTMLButtonElement | null>>([]);

  const close = useCallback(() => {
    setOpen(false);
    // Return focus to the trigger for keyboard users.
    triggerRef.current?.focus();
  }, []);

  const computePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const menuWidth = menuRef.current?.offsetWidth ?? MENU_WIDTH;

    // Vertical: prefer below; flip above when there isn't room below but there is above.
    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const placement: Placement =
      spaceBelow < menuHeight + GAP + MARGIN && spaceAbove > spaceBelow ? "top" : "bottom";
    let top = placement === "bottom" ? rect.bottom + GAP : rect.top - menuHeight - GAP;

    // Horizontal: align to the button's edge per document direction, then clamp on-screen.
    const isRtl = document.documentElement.dir === "rtl";
    let left = isRtl ? rect.right - menuWidth : rect.left;

    left = Math.min(Math.max(left, MARGIN), vw - menuWidth - MARGIN);
    top = Math.min(Math.max(top, MARGIN), vh - menuHeight - MARGIN);

    setPos({ top, left, placement });
  }, []);

  // Measure + place as soon as the menu is in the DOM, before paint (no flicker).
  useIsomorphicLayoutEffect(() => {
    if (!open) return;
    computePosition();
    // Trigger the enter transition on the next frame.
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [open, computePosition]);

  // Focus the first item when the menu opens.
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  // Global listeners while open: outside-click, Escape, reposition on scroll/resize.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    const onReposition = () => computePosition();
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    // capture:true so we also catch scrolls inside the table's scroll container.
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, close, computePosition]);

  const toggle = () => {
    if (open) {
      setOpen(false);
    } else {
      setMounted(false);
      setOpen(true);
    }
  };

  const select = (item: AdActionItem) => {
    if (item.disabled) return;
    setOpen(false);
    item.onClick?.();
  };

  // Roving focus between menu items with the arrow keys.
  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const focusable = itemRefs.current.filter(Boolean) as Array<HTMLElement>;
    if (focusable.length === 0) return;
    const currentIndex = focusable.findIndex((el) => el === document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusable[(currentIndex + 1 + focusable.length) % focusable.length].focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusable[(currentIndex - 1 + focusable.length) % focusable.length].focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      focusable[0].focus();
    } else if (event.key === "End") {
      event.preventDefault();
      focusable[focusable.length - 1].focus();
    }
  };

  const itemClass = (item: AdActionItem) =>
    cn(
      "flex w-full items-center gap-sm px-md py-2 text-start text-body-sm font-body-sm transition-colors outline-none",
      item.variant === "danger"
        ? "text-error hover:bg-error-container/40 focus-visible:bg-error-container/40"
        : "text-on-surface hover:bg-surface-container-low focus-visible:bg-surface-container-low",
      item.disabled && "opacity-60 pointer-events-none",
    );

  const iconClass = (item: AdActionItem) =>
    item.variant === "danger" ? "text-error" : "text-on-surface-variant";

  return (
    <div className="flex justify-center">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant bg-surface-container text-on-surface transition hover:bg-surface-container-highest focus-visible:ring-2 focus-visible:ring-primary/40 outline-none"
      >
        <Icon name="more_vert" size={20} />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-orientation="vertical"
              onKeyDown={onMenuKeyDown}
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: MENU_WIDTH,
                transformOrigin: pos.placement === "bottom" ? "top" : "bottom",
              }}
              className={cn(
                "z-50 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest py-1 shadow-lg",
                "transition duration-150 ease-out",
                mounted ? "opacity-100 scale-100" : "opacity-0 scale-95",
              )}
            >
              {items.map((item, index) => (
                <div key={item.key}>
                  {item.dividerBefore ? <div className="my-1 h-px bg-outline-variant" /> : null}
                  {item.href ? (
                    <Link
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      role="menuitem"
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={itemClass(item)}
                    >
                      <Icon name={item.icon} size={18} className={iconClass(item)} />
                      <span>{item.label}</span>
                    </Link>
                  ) : (
                    <button
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      type="button"
                      role="menuitem"
                      disabled={item.disabled}
                      onClick={() => select(item)}
                      className={itemClass(item)}
                    >
                      <Icon name={item.icon} size={18} className={iconClass(item)} />
                      <span>{item.label}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
