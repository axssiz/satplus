import { cn } from "@/lib/utils";

/** Sat+ wordmark: "Sat" + a green rounded plus tile. */
export function SatLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-display text-[1.35rem] font-semibold tracking-tight", className)}>
      <span>Sat</span>
      <span
        aria-hidden
        className="grid size-[1.35em] place-items-center rounded-[0.42em] bg-primary text-primary-foreground shadow-[0_6px_16px_-6px_var(--primary)]"
      >
        <svg viewBox="0 0 24 24" className="size-[0.8em]" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
      <span className="sr-only">Sat+</span>
    </span>
  );
}

/** QaiArzan mark: a price tag with a check, and a two-tone wordmark. */
export function QaiArzanLogo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="grid size-9 place-items-center rounded-xl bg-deal text-deal-foreground shadow-[0_8px_20px_-8px_var(--deal)]"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12.2V5a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6l7.3 7.3a2 2 0 0 1 0 2.8l-7.2 7.2a2 2 0 0 1-2.8 0L3.6 13.6A2 2 0 0 1 3 12.2Z" />
          <path d="m8.5 12 2.2 2.2 4.3-4.4" />
        </svg>
      </span>
      {!compact && (
        <span className="font-display text-lg font-semibold tracking-tight">
          Qai<span className="text-primary">Arzan</span>
        </span>
      )}
    </span>
  );
}
