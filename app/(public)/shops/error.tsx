"use client";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";

export default function ShopsError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Container className="py-16">
      <EmptyState
        title="We couldn't load shops right now"
        description="Please try again in a moment."
        action={<Button onClick={() => retry()}>Try again</Button>}
      />
    </Container>
  );
}
