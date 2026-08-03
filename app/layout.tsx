import type { ReactNode } from "react";
import "@/styles/globals.css";

/**
 * Passthrough root layout. The real <html>/<body> live in [locale]/layout.tsx
 * so the lang/dir attributes can depend on the active locale.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
