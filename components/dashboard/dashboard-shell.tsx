import Link from "next/link";
import { Suspense } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { Container } from "@/components/ui/container";
import { getSessionUser } from "@/lib/auth/session";
import { ActiveDashboardNav, DashboardNavLinks, type DashboardNavItem } from "./dashboard-nav";

export type { DashboardNavItem };

/**
 * Shared chrome for the customer, shopkeeper and admin areas. The shell is
 * static; only the user's name streams in. Each page still enforces its role
 * with requireRole() — layouts don't re-run on navigation, so they can't guard.
 */
export function DashboardShell({
  title,
  nav,
  navFooter,
  children,
}: {
  title: string;
  nav: DashboardNavItem[];
  /** Shown under the menu on medium screens and up (e.g. the shopkeeper's "Need help?" box). */
  navFooter?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/40">
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <Container className="flex h-16 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex items-center gap-2 font-bold text-primary">
              <span aria-hidden>💧</span> Aqua
            </Link>
            <span className="truncate border-l border-border pl-3 text-sm font-medium text-muted-foreground">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <Suspense fallback={<span className="h-5 w-24 animate-pulse rounded bg-muted" />}>
              <UserName />
            </Suspense>
            <LogoutButton className="whitespace-nowrap px-2 sm:px-4" />
          </div>
        </Container>
      </header>

      <Container className="flex flex-1 flex-col gap-6 py-6 md:flex-row md:py-8">
        <div className="flex flex-col gap-6 md:w-52 md:shrink-0">
          <nav aria-label={`${title} navigation`}>
            <Suspense fallback={<DashboardNavLinks items={nav} activePath={null} />}>
              <ActiveDashboardNav items={nav} />
            </Suspense>
          </nav>
          {navFooter && <div className="hidden md:block">{navFooter}</div>}
        </div>
        <main id="main" className="min-w-0 flex-1">{children}</main>
      </Container>
    </div>
  );
}

/** The signed-in user's name. */
async function UserName() {
  const user = await getSessionUser();
  if (!user) return null;
  return <span className="hidden max-w-40 truncate text-sm md:inline">{user.name}</span>;
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <div className="h-8 w-1/2 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
