"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** Shared body for error.tsx boundaries. Shows no internals; the digest helps match server logs. */
export function RouteError({ error, retry, homeHref = "/" }: { error: Error & { digest?: string }; retry: () => void; homeHref?: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="py-16">
      <EmptyState
        title="Something went wrong"
        description={`Please try again.${error.digest ? ` If it keeps happening, mention code ${error.digest}.` : ""}`}
        action={
          <div className="flex gap-2">
            <Button onClick={() => retry()}>Try again</Button>
            <Link href={homeHref} className={buttonClasses({ variant: "secondary" })}>
              Go back
            </Link>
          </div>
        }
      />
    </div>
  );
}
