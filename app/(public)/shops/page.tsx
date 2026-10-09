import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ShopCard } from "@/components/shops/shop-card";
import { ShopFilters } from "@/components/shops/shop-filters";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { searchShops } from "@/lib/services/shops";
import { shopSearchSchema } from "@/lib/validation/shops";

export const metadata: Metadata = {
  title: "Find water shops near you",
  description: "Search verified water shops by location, product, price, and rating.",
};

export default function ShopsPage({ searchParams }: PageProps<"/shops">) {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-10">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Find water shops</h1>
        <p className="mt-1 text-muted-foreground">Verified shops, real prices, delivered to your door.</p>
      </div>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
        <ShopFilters />
      </Suspense>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/shops">["searchParams"] }) {
  const raw = await searchParams;
  // Results depend on the visitor's exact location, so render them per request
  // rather than letting a prefetch prerender run the uncached DB query.
  await connection();
  // Search params are user-controlled; fall back to defaults rather than erroring.
  const parsed = shopSearchSchema.safeParse(firstValues(raw));
  const input = parsed.success ? parsed.data : shopSearchSchema.parse({});
  const result = await searchShops(input);

  if (result.items.length === 0) {
    return (
      <EmptyState
        title="No shops found"
        description={
          input.lat !== undefined
            ? "Try a larger distance or fewer filters."
            : "Try a different search or fewer filters."
        }
      />
    );
  }

  const hrefFor = (page: number) => {
    const qs = new URLSearchParams(firstValues(raw) as Record<string, string>);
    qs.set("page", String(page));
    return `/shops?${qs.toString()}`;
  };

  return (
    <section aria-label="Results" className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {result.total} {result.total === 1 ? "shop" : "shops"} found
        {!parsed.success && " (some filters were invalid and ignored)"}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {result.items.map((shop) => (
          <ShopCard key={shop.id} shop={shop} />
        ))}
      </div>
      <Pagination page={result.page} totalPages={result.totalPages} hrefFor={hrefFor} />
    </section>
  );
}

/** Repeated query keys (?a=1&a=2) arrive as arrays; keep the first. */
function firstValues(raw: Record<string, string | string[] | undefined>) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v !== undefined) out[key] = v;
  }
  return out;
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-44 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
