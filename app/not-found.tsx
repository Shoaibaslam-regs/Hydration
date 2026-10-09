import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <Container className="flex flex-1 items-center py-16">
      <EmptyState
        className="w-full"
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/" className={buttonClasses()}>
              Home
            </Link>
            <Link href="/shops" className={buttonClasses({ variant: "secondary" })}>
              Find shops
            </Link>
          </div>
        }
      />
    </Container>
  );
}
