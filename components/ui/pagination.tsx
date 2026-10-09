import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

/** Server-side pagination links. `hrefFor` must preserve the current filters. */
export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={buttonClasses({ variant: "secondary" })} rel="prev">
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={buttonClasses({ variant: "secondary" })} rel="next">
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
