import Link from "next/link";
import { cn } from "@/lib/utils";

/** Pill links for URL-based filters (status tabs). Scrolls horizontally on small screens. */
export function FilterTabs({ label, tabs }: { label: string; tabs: { label: string; href: string; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex gap-1">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "block whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium",
                t.active ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
