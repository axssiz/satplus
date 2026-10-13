"use client";

import { ScanBarcode, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { BarcodeScanner } from "./barcode-scanner";

export function SearchBox({
  defaultValue = "",
  placeholder,
  action = "/prices",
  size = "lg",
  autoFocus = false,
  extraParams,
  className,
  scanner = true,
}: {
  defaultValue?: string;
  placeholder: string;
  action?: string;
  size?: "md" | "lg";
  autoFocus?: boolean;
  extraParams?: Record<string, string | undefined>;
  className?: string;
  /** Show the barcode scanner button (product search only). */
  scanner?: boolean;
}) {
  const t = useTranslations("prices");
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [scanOpen, setScanOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Follow URL changes (back/forward, new search) without a setState-in-effect.
  const [syncedDefault, setSyncedDefault] = useState(defaultValue);
  if (syncedDefault !== defaultValue) {
    setSyncedDefault(defaultValue);
    setValue(defaultValue);
  }

  const go = (q: string) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(extraParams ?? {})) if (v) params.set(k, v);
    if (q.trim()) params.set("q", q.trim());
    const qs = params.toString();
    router.push(qs ? `${action}?${qs}` : action);
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
      className={cn("relative flex w-full items-center", className)}
    >
      <Search className="pointer-events-none absolute left-4 size-5 text-muted-foreground" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        maxLength={100}
        enterKeyHint="search"
        className={cn(
          "w-full rounded-2xl border border-border bg-card pl-12 text-[15px] shadow-soft outline-none transition placeholder:text-muted-foreground/80 focus:border-primary focus:ring-4 focus:ring-primary/15 [&::-webkit-search-cancel-button]:hidden",
          size === "lg" ? "h-14" : "h-12",
          scanner ? "pr-24" : "pr-12",
        )}
      />
      <div className="absolute right-2 flex items-center gap-1">
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-surface-2"
            aria-label="×"
          >
            <X className="size-4" />
          </button>
        )}
        {scanner && (
        <button
          type="button"
          onClick={() => setScanOpen(true)}
          className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          aria-label={t("scanBarcode")}
          title={t("scanBarcode")}
        >
          <ScanBarcode className="size-5" />
        </button>
        )}
      </div>
      {scanner && <BarcodeScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        onDetected={(code) => {
          setScanOpen(false);
          setValue(code);
          go(code);
        }}
      />}
    </form>
  );
}
