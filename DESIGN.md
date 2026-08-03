---
name: Souqna / سوقنا
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#525657'
  on-tertiary: '#ffffff'
  tertiary-container: '#6b6e70'
  on-tertiary-container: '#eff1f3'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
  gutter: 24px
  margin: 32px
---

## Brand & Style
The design system is anchored in the concept of a "Modern Digital Agora." It blends the efficiency of premium global SaaS platforms (Stripe, Linear) with the communal trust of a local marketplace. The personality is professional, sophisticated, and remarkably clean, prioritizing clarity of commerce over visual noise.

The style is **Premium Minimalist**. It utilizes generous whitespace, precise alignment, and subtle depth to create a focused user experience. The aesthetic is "Desktop-first," ensuring that density is managed through structural hierarchy rather than clutter. The system is bi-directional by default, ensuring a seamless transition between English (LTR) and Arabic (RTL) without compromising the elegant, high-contrast character of the brand.

## Colors
The palette is built on "Professional Blue" to signal reliability and speed. We use a sophisticated scale of Slates to provide structure. 
- **Primary:** Used for key actions (Purchase) and active states.
- **Surface:** We use `#FFFFFF` for primary cards and `#F8FAFC` for page backgrounds to create a subtle layered effect.
- **Text:** High-contrast `#0F172A` is used for headings to ensure maximum readability, while `#64748B` is used for metadata and secondary labels.
- **Accents:** Feedback colors (Success/Error) are slightly desaturated to maintain the premium, non-aggressive SaaS aesthetic.

## Typography
The typography system uses **Inter** for English text to achieve a neutral, systematic feel. For Arabic, it pairs with a professional Kufi-inspired sans-serif like **IBM Plex Sans Arabic** to maintain the same modern, geometric weight.

- **Weight Strategy:** Use Semibold (600) for primary headings and Bold (700) for Display roles. Regular (400) is reserved for all body copy to maintain a light, airy feel.
- **RTL Handling:** When rendering Arabic, increase line-height by 10-15% to accommodate the taller ascenders/descenders of the script.
- **Contrast:** Utilize color (Slate 900 vs Slate 600) rather than just size to denote hierarchy.

## Layout & Spacing
This design system follows an **8px grid system** for primary layout and a **4px sub-grid** for fine-grained component details.

- **Grid:** A 12-column fluid grid for desktop with a maximum container width of 1440px. 
- **Margins:** Desktop margins are generous (32px+) to evoke a sense of high-end editorial design.
- **Adaptive Rules:** On tablet (under 1024px), columns reduce to 8. On mobile (under 640px), columns reduce to 4 with margins shrinking to 16px.
- **RTL:** All horizontal spacing (padding-left, margin-right) must be mirrored. Use logical properties (`padding-inline-start`) in development.

## Elevation & Depth
Depth is created through "Linear" style multi-layered shadows rather than heavy borders.

- **Level 1 (Cards):** Small, soft shadow to lift the element from the light gray background.
  *Box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)*
- **Level 2 (Dropdowns/Popovers):** Medium shadow for interactive elements.
  *Box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)*
- **Level 3 (Modals):** Large, diffused shadow to focus attention.
  *Box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)*
- **Borders:** Use a 1px solid border in Slate 200 for elements that need definition without shadow.

## Shapes
The shape language is "Soft-Modern." 
- **Cards/Modals:** 12px - 16px corner radius to feel approachable and high-end.
- **Buttons/Inputs:** 8px corner radius to provide a slightly more precise, functional look.
- **Status Badges:** Fully rounded (pill) to distinguish them from interactive buttons.
- **Images:** Always clipped to the parent container's 12px radius.

## Components

### Buttons
- **Primary:** Solid Professional Blue (#2563EB). White text. 8px radius. Hover: slight darken.
- **Secondary:** Slate 100 background with Slate 900 text. Hover: Slate 200.
- **Ghost:** No background/border. Primary color text. Used for "Cancel" or less-prominent actions.
- **Outline:** 1px Slate 200 border. Slate 900 text. Hover: Slate 50.

### Inputs & Search
- **Standard Input:** 8px radius, Slate 200 border. 16px padding. On Focus: 1px Professional Blue border with a 3px soft blue glow (ring).
- **Search Bar:** Large 12px radius. Includes a search icon on the leading side and a "/" shortcut indicator on the trailing side.

### Product Cards
- **Structure:** 12px radius. Top-weighted image. 
- **Content:** Title (Semibold), Price (Primary color, Bold), Meta-info (Location, Time) in Slate 500 with small line icons.
- **CTA:** "Request Purchase" button spans the full width of the card footer.
- **Interaction:** Hover state triggers a subtle scale (1.02x) and a slightly deeper shadow.

### Navigation
- **Navbar:** Sticky, white background with a thin Slate 100 bottom border. Minimal logo on the left (right in RTL) and primary actions on the opposite side.
- **Sidebar:** Clean, transparent background. Active states use a soft Slate 100 "highlight" shape with a 4px primary color vertical indicator on the leading edge.

### Feedback & Data
- **Badges:** Small, pill-shaped. Soft background (e.g., Success 100) with dark text (Success 900).
- **Toast:** Positioned bottom-right (bottom-left in RTL). Dark Slate 900 background for high contrast.
- **Empty States:** Centered, using large Slate 100 iconography and a single Primary CTA button.
- **Loading Skeletons:** Soft gray pulses (#F1F5F9 to #E2E8F0).