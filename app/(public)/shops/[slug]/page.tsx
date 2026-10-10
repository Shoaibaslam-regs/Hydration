import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { OrderBuilder } from "@/components/customer/order-builder";
import { ShopFavorite } from "@/components/customer/shop-favorite";
import { LocationMap } from "@/components/map/location-map";
import { Rating } from "@/components/shops/rating";
import { VerifiedBadge } from "@/components/shops/verified-badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, formatPrice } from "@/lib/catalog";
import { getPlatformSettings } from "@/lib/services/platform-settings";
import { getShopBySlug, type ShopDetail } from "@/lib/services/shops";
import { shopSlugSchema } from "@/lib/validation/shops";

async function loadShop(params: PageProps<"/shops/[slug]">["params"]): Promise<ShopDetail | null> {
  const parsed = shopSlugSchema.safeParse((await params).slug);
  return parsed.success ? getShopBySlug(parsed.data) : null;
}

export async function generateMetadata({ params }: PageProps<"/shops/[slug]">): Promise<Metadata> {
  const shop = await loadShop(params);
  if (!shop) return { title: "Shop not found" };
  return {
    title: `${shop.name} — ${shop.city}`,
    description: shop.description || `Order drinking water from ${shop.name} in ${shop.area || shop.city}.`,
  };
}

export default function ShopPage({ params }: PageProps<"/shops/[slug]">) {
  return (
    <Container className="py-8 sm:py-10">
      <Link href="/shops" className="text-sm text-muted-foreground hover:text-foreground">
        ← All shops
      </Link>
      <Suspense fallback={<ShopSkeleton />}>
        <ShopContent params={params} />
      </Suspense>
    </Container>
  );
}

async function ShopContent({ params }: { params: PageProps<"/shops/[slug]">["params"] }) {
  const shop = await loadShop(params);
  if (!shop) notFound();
  // The plan check compares with the current time, so render it per request.
  await connection();
  const settings = await getPlatformSettings();
  const planInactive = settings.requireSubscription && !(shop.planEndsAt && new Date(shop.planEndsAt) > new Date());

  const address = [shop.addressLine1, shop.area, shop.city].filter(Boolean).join(", ");

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-2xl font-bold sm:text-3xl">{shop.name}</h1>
              {shop.hasVerifiedBadge && <VerifiedBadge />}
            </div>
            <Suspense fallback={null}>
              <ShopFavorite shopId={shop.id} slug={shop.slug} />
            </Suspense>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <Rating average={shop.rating.average} count={shop.rating.count} />
            <span>{address}</span>
          </div>
          {shop.description && <p className="mt-2 text-muted-foreground">{shop.description}</p>}
        </header>

        {shop.deals.length > 0 && !shop.closure && (
          <section aria-labelledby="deals-heading" className="flex flex-col gap-2">
            <h2 id="deals-heading" className="text-lg font-semibold">
              Deals
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {shop.deals.map((d) => (
                <li key={d.id} className="flex flex-col gap-1 rounded-xl border border-warning/40 bg-warning/10 p-3">
                  <span className="font-semibold">{d.title}</span>
                  {d.description && <span className="text-sm text-muted-foreground">{d.description}</span>}
                  <span className="text-xs text-muted-foreground">Until {formatDateTime(d.endsAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="products-heading" className="flex flex-col gap-3">
          <h2 id="products-heading" className="text-lg font-semibold">
            Order water
          </h2>
          {planInactive && !shop.closure ? (
            <div role="status" className="rounded-xl border border-warning/50 bg-warning/10 p-4">
              <p className="font-semibold">This shop isn&apos;t taking orders right now</p>
              <p className="text-sm text-muted-foreground">Save it to find it again later, or find another shop nearby.</p>
            </div>
          ) : shop.closure ? (
            <div role="status" className="rounded-xl border border-warning/50 bg-warning/10 p-4">
              <p className="font-semibold">This shop is closed right now</p>
              <p className="text-sm text-muted-foreground">
                {shop.closure.by === "shopkeeper" && shop.closure.reason
                  ? shop.closure.reason
                  : "It isn't taking new orders at the moment. Save it to find it again later, or find another shop nearby."}
              </p>
            </div>
          ) : shop.products.length === 0 ? (
            <EmptyState title="No products listed yet" />
          ) : (
            <OrderBuilder shopSlug={shop.slug} products={shop.products} deliveryFee={shop.deliveryFee} />
          )}
        </section>

        <section aria-labelledby="reviews-heading" className="flex flex-col gap-3">
          <h2 id="reviews-heading" className="text-lg font-semibold">
            Reviews
          </h2>
          {shop.reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet. Reviews come from customers who ordered here.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {shop.reviews.map((r) => (
                <li key={r.id}>
                  <Card className="flex flex-col gap-1 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{r.authorName}</span>
                      <span className="text-warning" aria-label={`${r.rating} out of 5 stars`}>
                        {"★".repeat(r.rating)}
                        <span className="text-border">{"★".repeat(5 - r.rating)}</span>
                      </span>
                    </div>
                    {r.comment && <p className="text-sm">{r.comment}</p>}
                    <p className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</p>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3">
          <CardTitle>Delivery</CardTitle>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Delivery fee</dt>
            <dd className="text-right">{shop.deliveryFee === 0 ? "Free" : formatPrice(shop.deliveryFee)}</dd>
            <dt className="text-muted-foreground">Delivers within</dt>
            <dd className="text-right">{shop.deliveryRadiusKm} km</dd>
            <dt className="text-muted-foreground">Hours</dt>
            <dd className="text-right">
              {shop.hours.opensAt}–{shop.hours.closesAt}
            </dd>
            <dt className="text-muted-foreground">Phone</dt>
            <dd className="text-right">
              <a href={`tel:${shop.phone}`} className="text-primary hover:underline">
                {shop.phone}
              </a>
            </dd>
            <dt className="text-muted-foreground">Payment</dt>
            <dd className="text-right">Cash on delivery</dd>
          </dl>
        </Card>
        <Card className="flex flex-col gap-3">
          <CardTitle>Location</CardTitle>
          <LocationMap value={shop.location} label={`Map showing ${shop.name}`} className="h-56" />
          <p className="text-sm text-muted-foreground">{address}</p>
        </Card>
      </aside>
    </div>
  );
}

function ShopSkeleton() {
  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-3" aria-busy>
      <div className="flex flex-col gap-4 lg:col-span-2">
        <div className="h-10 w-2/3 animate-pulse rounded-lg bg-muted" />
        <div className="h-5 w-1/2 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
