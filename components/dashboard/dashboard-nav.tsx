"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CountBadge } from "@/components/notifications/count-badge";
import { useNotificationCounts } from "@/components/notifications/use-notification-counts";
import { cn } from "@/lib/utils";

export type DashboardNavItem = { href: string; label: string };

/**
 * Section links. Wraps on small screens so nothing hides off-screen;
 * highlights the current section and shows waiting counts (new orders, requests).
 */
export function DashboardNavLinks({ items, activePath }: { items: DashboardNavItem[]; activePath: string | null }) {
  const { counts } = useNotificationCounts(activePath);
  // The section root (first item) matches exactly; others also match their sub-pages.
  const isActive = (href: string, i: number) =>
    activePath !== null && (i === 0 ? activePath === href : activePath === href || activePath.startsWith(`${href}/`));
  return (
    <ul className="flex flex-wrap gap-1 md:flex-col">
      {items.map((item, i) => {
        const active = isActive(item.href, i);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium",
                active ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground",
              )}
            >
              {item.label}
              <CountBadge count={counts[item.href] ?? 0} label="new" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Reads the URL, so render it inside <Suspense> (fallback: the same links without a highlight). */
export function ActiveDashboardNav({ items }: { items: DashboardNavItem[] }) {
  return <DashboardNavLinks items={items} activePath={usePathname()} />;
}
