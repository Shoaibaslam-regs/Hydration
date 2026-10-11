import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdChip } from "@/components/ads/ad-chip";
import { AdImpression } from "@/components/ads/ad-impression";
import { ShopCard } from "@/components/shops/shop-card";
import { ShopFilters } from "@/components/shops/shop-filters";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { findSponsoredShops } from "@/lib/services/ads/sponsored";
import { searchShops } from "@/lib/services/shops";
import { shopSearchSchema } from "@/lib/validation/shops";

export const metadata: Metadata = {
  title: "Find water shops near you",
  description: "Find water shops near you: type your area or use your location, compare prices per can and ratings.",
};

export default function ShopsPage({ searchParams }: PageProps<"/shops">) {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-10">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Find water shops</h1>
        <p className="mt-1 text-muted-foreground">Local shops, real prices, delivered to your door.</p>
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
  // Sponsored slots only above the first page, and only for located searches (including a resolved typed area).
  // With a known location both queries run at once; a typed area must be resolved first.
  const located = input.lat !== undefined && input.lng !== undefined;
  const [result, early] = await Promise.all([
    searchShops(input),
    located && input.page === 1 ? findSponsoredShops(input) : Promise.resolve(null),
  ]);
  const sponsored =
    result.page !== 1 || result.items.length === 0
      ? []
      : early && !result.widenedToKm
        ? early
        : await findSponsoredShops(result.searched);

  if (result.placeNotFound) {
    return (
      <EmptyState
        title={`We couldn't find “${input.q}”`}
        description="Try the name of your area or a nearby landmark (for example “Gulshan-e-Bahar” or “Orangi Town”), or use your location."
      />
    );
  }
  if (result.items.length === 0) {
    return (
      <EmptyState
        title="No shops found"
        description={
          result.searched.lat !== undefined
            ? `No shops deliver within ${result.searched.radiusKm} km yet. Try fewer filters, or check back soon.`
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
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {result.total} {result.total === 1 ? "shop" : "shops"} found
          {result.place && (
            <>
              {" "}
              near <span className="font-medium text-foreground">{result.place.label || input.q}</span>, nearest first
            </>
          )}
          {!parsed.success && " (some filters were invalid and ignored)"}
        </p>
        {result.widenedToKm && (
          <p className="text-sm text-muted-foreground" role="status">
            No shops within {input.radiusKm} km, so we searched up to {result.widenedToKm} km.
          </p>
        )}
      </div>
      {sponsored.length > 0 && (
        <section aria-labelledby="featured-heading" className="flex flex-col gap-3 rounded-2xl bg-premium-soft/60 p-3 ring-1 ring-premium/20 sm:p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="featured-heading" className="font-semibold">
              <span aria-hidden className="text-premium">★ </span>Featured near you
            </h2>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Paid placements <AdChip />
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {sponsored.map((shop) => (
              <AdImpression key={shop.id} kind="sponsored" id={shop.id} className="flex">
                <div className="flex w-full flex-col [&>*]:flex-1">
                  <ShopCard shop={shop} sponsored />
                </div>
              </AdImpression>
            ))}
          </div>
        </section>
      )}
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
