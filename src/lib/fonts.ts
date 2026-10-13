import { Onest, Unbounded } from "next/font/google";

export const onest = Onest({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-onest",
  display: "swap",
});

export const unbounded = Unbounded({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-unbounded",
  weight: ["500", "600", "700"],
  display: "swap",
});
