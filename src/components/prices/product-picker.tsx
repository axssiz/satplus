"use client";

import { Loader2, Search } from "lucide-react";
import { useLocale } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import type { ProductLite } from "@/app/api/products/search/route";
import { fieldClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ProductPicker({
  placeholder,
  onPick,
  exclude = [],
  autoFocus,
}: {
  placeholder: string;
  onPick: (p: ProductLite) => void;
  exclude?: string[];
  autoFocus?: boolean;
}) {
  const locale = useLocale();
  const listId = useId();
  const [q, setQ] = useState("");
  const [results, setItems] = useState<ProductLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ctrl = useRef<AbortController | null>(null);
  const items = q.trim().length < 2 ? [] : results;

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const timer = setTimeout(async () => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      setLoading(true);
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(term)}`, { signal: c.signal });
        const json = (await res.json()) as { items: ProductLite[] };
        setItems(json.items.filter((i) => !exclude.includes(i.id)));
        setActive(0);
        setOpen(true);
      } catch {
        // aborted or offline
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [q, exclude]);

  const pick = (p: ProductLite) => {
    onPick(p);
    setQ("");
    setItems([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-muted-foreground" aria-hidden />
      <input
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => items.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!items.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(items[active]);
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(fieldClass, "h-11 pl-10")}
      />
      {loading && <Loader2 className="absolute right-3.5 top-3.5 size-4 animate-spin text-muted-foreground" aria-hidden />}
      {open && items.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border bg-card p-1 shadow-lift">
          {items.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("cursor-pointer rounded-lg px-3 py-2 text-sm", i === active && "bg-surface-2")}
            >
              <span className="font-medium">{locale === "kk" && p.nameKk ? p.nameKk : p.nameRu}</span>
              {p.brandName && <span className="text-muted-foreground"> · {p.brandName}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
