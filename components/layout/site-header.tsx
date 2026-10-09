import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { ActiveNavLinks } from "./active-nav-links";
import { HeaderAuth, HeaderAuthSkeleton } from "./header-auth";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-primary">
          <span aria-hidden>💧</span> Aqua
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {/* Prerendered without highlight; the active state streams in. */}
          <Suspense fallback={<NavLinks activePath={null} />}>
            <ActiveNavLinks />
          </Suspense>
        </nav>

        <div className="hidden md:block">
          <Suspense fallback={<HeaderAuthSkeleton layout="inline" />}>
            <HeaderAuth layout="inline" />
          </Suspense>
        </div>

        <MobileMenu
          auth={
            <Suspense fallback={<HeaderAuthSkeleton layout="stacked" />}>
              <HeaderAuth layout="stacked" />
            </Suspense>
          }
        />
      </Container>
    </header>
  );
}
