import type { ReactNode } from "react";
import "./globals.css";

// Each top-level area ([locale] and admin) renders its own <html>.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
