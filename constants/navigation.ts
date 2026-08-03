import { ROUTES } from "@/constants/routes";

export interface NavItem {
  href: string;
  /** i18n key under `dashboard.nav.*`. */
  labelKey: string;
  icon: string;
  exact?: boolean;
  /** Optional child items rendered as a nested group. */
  children?: NavItem[];
}

export const DASHBOARD_NAV: NavItem[] = [
  { href: ROUTES.dashboard, labelKey: "dashboard", icon: "dashboard", exact: true },
  {
    href: ROUTES.ads,
    labelKey: "advertisements",
    icon: "campaign",
    children: [
      { href: ROUTES.adsPending, labelKey: "pendingAds", icon: "pending_actions" },
      { href: ROUTES.ads, labelKey: "allAds", icon: "list_alt" },
      { href: ROUTES.adsReported, labelKey: "reportedAds", icon: "flag" },
    ],
  },
  { href: ROUTES.users, labelKey: "users", icon: "group" },
  { href: ROUTES.categories, labelKey: "categories", icon: "category" },
  { href: ROUTES.analytics, labelKey: "analytics", icon: "monitoring" },
  { href: ROUTES.dashboardSettings, labelKey: "settings", icon: "settings" },
];
