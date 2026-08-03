import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

/**
 * Design tokens ported 1:1 from the original Stitch export (see souqna/DESIGN.md).
 * Previously duplicated inline inside every HTML file's <script id="tailwind-config">.
 * Centralised here so the whole app shares a single source of truth.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./constants/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "on-tertiary-container": "#eff1f3",
        "inverse-surface": "#213145",
        "outline-variant": "#c3c6d7",
        "on-primary-fixed-variant": "#003ea8",
        "on-primary-container": "#eeefff",
        "on-secondary-fixed-variant": "#3f465c",
        tertiary: "#525657",
        "surface-tint": "#0053db",
        "on-secondary-fixed": "#131b2e",
        "on-error": "#ffffff",
        "surface-container-lowest": "#ffffff",
        surface: "#f8f9ff",
        "inverse-on-surface": "#eaf1ff",
        "primary-fixed": "#dbe1ff",
        error: "#ba1a1a",
        outline: "#737686",
        "tertiary-fixed": "#e0e3e5",
        "secondary-container": "#dae2fd",
        "on-secondary": "#ffffff",
        "surface-container-highest": "#d3e4fe",
        "on-surface": "#0b1c30",
        "surface-variant": "#d3e4fe",
        "surface-container": "#e5eeff",
        "primary-container": "#2563eb",
        "on-tertiary": "#ffffff",
        "error-container": "#ffdad6",
        "on-tertiary-fixed-variant": "#444749",
        secondary: "#565e74",
        "inverse-primary": "#b4c5ff",
        primary: "#004ac6",
        "on-primary": "#ffffff",
        "on-error-container": "#93000a",
        "tertiary-container": "#6b6e70",
        "surface-container-high": "#dce9ff",
        "tertiary-fixed-dim": "#c4c7c9",
        "surface-dim": "#cbdbf5",
        "surface-container-low": "#eff4ff",
        "primary-fixed-dim": "#b4c5ff",
        "surface-bright": "#f8f9ff",
        "on-primary-fixed": "#00174b",
        "on-surface-variant": "#434655",
        background: "#f8f9ff",
        "secondary-fixed": "#dae2fd",
        "on-secondary-container": "#5c647a",
        "secondary-fixed-dim": "#bec6e0",
        "on-tertiary-fixed": "#191c1e",
        "on-background": "#0b1c30",
        scrim: "#000000",
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        full: "9999px",
      },
      spacing: {
        base: "4px",
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "40px",
        "2xl": "64px",
        gutter: "24px",
        margin: "32px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-arabic)", "sans-serif"],
        arabic: ["var(--font-arabic)", "var(--font-inter)", "sans-serif"],
        "display-lg": ["var(--font-inter)"],
        "headline-lg": ["var(--font-inter)"],
        "headline-md": ["var(--font-inter)"],
        "body-lg": ["var(--font-inter)"],
        "body-md": ["var(--font-inter)"],
        "body-sm": ["var(--font-inter)"],
        "label-md": ["var(--font-inter)"],
      },
      fontSize: {
        "display-lg": ["48px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "1.5", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        "label-md": ["12px", { lineHeight: "1", letterSpacing: "0.05em", fontWeight: "600" }],
      },
      maxWidth: {
        "7xl": "80rem",
        "1440": "1440px",
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    // Direction-aware variants so a single component works in both RTL and LTR.
    plugin(({ addVariant }) => {
      addVariant("rtl", '&:where([dir="rtl"], [dir="rtl"] *)');
      addVariant("ltr", '&:where([dir="ltr"], [dir="ltr"] *)');
    }),
  ],
};

export default config;
