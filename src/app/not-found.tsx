import Link from "next/link";
import { onest } from "@/lib/fonts";

// Fallback for paths outside the localized area.
export default function GlobalNotFound() {
  return (
    <html lang="ru" className={onest.variable}>
      <body className="grid min-h-dvh place-items-center bg-background p-6 text-center">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold">Страница не найдена</h1>
          <Link className="font-semibold text-primary-strong underline" href="/">
            На главную Sat+
          </Link>
        </div>
      </body>
    </html>
  );
}
