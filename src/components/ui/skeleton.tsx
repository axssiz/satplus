import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-xl bg-[linear-gradient(90deg,var(--surface-2)_0%,var(--surface)_50%,var(--surface-2)_100%)] bg-[length:200%_100%]",
        className,
      )}
    />
  );
}
