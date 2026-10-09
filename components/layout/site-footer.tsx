import Link from "next/link";
import { Container } from "@/components/ui/container";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/50">
      <Container className="flex flex-col gap-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-semibold text-foreground">Aqua</span> — fresh water from shops near you.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-4">
          <Link href="/shops" className="hover:text-foreground">Find shops</Link>
          <Link href="/pricing" className="hover:text-foreground">For shopkeepers</Link>
          <Link href="/login" className="hover:text-foreground">Log in</Link>
        </nav>
      </Container>
    </footer>
  );
}
