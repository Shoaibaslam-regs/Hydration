import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";

export default function ShopNotFound() {
  return (
    <Container className="py-16">
      <EmptyState
        title="Shop not found"
        description="This shop doesn't exist or isn't available right now."
        action={
          <Link href="/shops" className={buttonClasses()}>
            Browse shops
          </Link>
        }
      />
    </Container>
  );
}
