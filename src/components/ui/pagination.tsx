import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Prev/next pagination with real links (crawlable, works without JS). */
export function Pagination({
  page,
  totalPages,
  hrefFor,
  labels,
  status,
}: {
  page: number;
  totalPages: number;
  hrefFor: (p: number) => string;
  labels: { prev: string; next: string };
  status: string;
}) {
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-2">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={buttonVariants({ variant: "outline" })} rel="prev">
          <ChevronLeft aria-hidden /> {labels.prev}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted-foreground">{status}</span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={buttonVariants({ variant: "outline" })} rel="next">
          {labels.next} <ChevronRight aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
