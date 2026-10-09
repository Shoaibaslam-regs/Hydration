import Link from "next/link";
import { cn } from "@/lib/utils";

export const NAV_LINKS = [
  { href: "/shops", label: "Find shops" },
  { href: "/pricing", label: "For shopkeepers" },
];

export function NavLinks({ activePath }: { activePath: string | null }) {
  return NAV_LINKS.map((link) => {
    const active = activePath?.startsWith(link.href) ?? false;
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        {link.label}
      </Link>
    );
  });
}
