import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { OrderBuilder } from "@/components/customer/order-builder";
import { ShopFavorite } from "@/components/customer/shop-favorite";
import { LocationMap } from "@/components/map/location-map";
import { Rating } from "@/components/shops/rating";
import { ShopAvatar } from "@/components/shops/shop-avatar";
import { VerifiedBadge } from "@/components/shops/verified-badge";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { formatDateTime, formatPrice } from "@/lib/catalog";
import { getShopBySlug, type ShopDetail } from "@/lib/services/shops";
import { isOpenAt } from "@/lib/shops/hours";
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
  // The plan and opening-hours checks compare with the current time, so render them per request.
  await connection();
  const now = new Date();
  const notTakingOrders = !shop.pricePerCan || !(shop.planEndsAt && new Date(shop.planEndsAt) > now);
  const openNow = isOpenAt(shop.hours, now);
  const address = [shop.addressLine1, shop.area, shop.city].filter(Boolean).join(", ");

  const facts = [
    { label: "Price per can", value: shop.pricePerCan ? formatPrice(shop.pricePerCan) : "—", strong: true },
    { label: "Delivery", value: shop.deliveryFee === 0 ? "Free" : formatPrice(shop.deliveryFee) },
    { label: "Hours", value: `${shop.hours.opensAt}–${shop.hours.closesAt}` },
    { label: "Delivers within", value: `${shop.deliveryRadiusKm} km` },
  ];

  return (
    <>
      <section className="relative mt-4 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-accent via-card to-card p-5 sm:p-8">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex items-start gap-4 sm:gap-5">
          <ShopAvatar name={shop.name} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{shop.name}</h1>
                  {shop.hasVerifiedBadge && <VerifiedBadge />}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{[shop.area, shop.city].filter(Boolean).join(", ")}</p>
              </div>
              <Suspense fallback={null}>
                <ShopFavorite shopId={shop.id} slug={shop.slug} />
              </Suspense>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-background/80 px-2.5 py-1 ring-1 ring-border">
                <Rating average={shop.rating.average} count={shop.rating.count} />
              </span>
              {shop.closure ? (
                <Badge tone="danger">Closed for now</Badge>
              ) : openNow ? (
                <Badge tone="success">● Open now · until {shop.hours.closesAt}</Badge>
              ) : (
                <Badge tone="neutral">Closed · opens {shop.hours.opensAt}</Badge>
              )}
              <Badge tone="info">Cash on delivery</Badge>
            </div>
          </div>
        </div>
        <dl className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="rounded-xl bg-background/80 p-3 ring-1 ring-border">
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className={f.strong ? "text-xl font-bold text-primary" : "text-base font-semibold"}>{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* First in the page order so phones see it right after the header; pinned beside the content on desktop. */}
        <aside className="flex flex-col gap-4 self-start lg:sticky lg:top-20 lg:col-start-3 lg:row-start-1">
          <Card className="flex flex-col gap-4 border-primary/30 shadow-md">
            <h2 className="text-lg font-semibold">Order water</h2>
            {shop.closure ? (
              <div role="status" className="rounded-xl border border-warning/50 bg-warning/10 p-4">
                <p className="font-semibold">This shop is closed right now</p>
                <p className="text-sm text-muted-foreground">
                  {shop.closure.by === "shopkeeper" && shop.closure.reason
                    ? shop.closure.reason
                    : "It isn't taking new orders at the moment. Save it to find it again later, or find another shop nearby."}
                </p>
              </div>
            ) : notTakingOrders ? (
              <div role="status" className="rounded-xl border border-warning/50 bg-warning/10 p-4">
                <p className="font-semibold">This shop isn&apos;t taking orders right now</p>
                <p className="text-sm text-muted-foreground">Save it to find it again later, or find another shop nearby.</p>
              </div>
            ) : (
              <OrderBuilder shopSlug={shop.slug} pricePerCan={shop.pricePerCan!} deliveryFee={shop.deliveryFee} />
            )}
          </Card>
          <Card className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Questions about your order?</p>
              <p className="truncate text-sm text-muted-foreground">{shop.phone}</p>
            </div>
            <a href={`tel:${shop.phone}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              📞 Call
            </a>
          </Card>
        </aside>

        <div className="flex flex-col gap-6 lg:col-span-2 lg:col-start-1 lg:row-start-1">
          {shop.deals.length > 0 && !shop.closure && (
            <section aria-labelledby="deals-heading" className="flex flex-col gap-3">
              <h2 id="deals-heading" className="text-lg font-semibold">
                Deals
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {shop.deals.map((d) => (
                  <li key={d.id} className="flex flex-col gap-1 rounded-xl border border-warning/40 bg-warning/10 p-4">
                    <span className="w-fit rounded bg-premium px-1.5 py-0.5 text-xs font-semibold text-premium-foreground">Deal</span>
                    <span className="font-semibold">{d.title}</span>
                    {d.description && <span className="text-sm text-muted-foreground">{d.description}</span>}
                    <span className="text-xs text-muted-foreground">Until {formatDateTime(d.endsAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {shop.description && (
            <Card className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">About {shop.name}</h2>
              <p className="whitespace-pre-line text-muted-foreground">{shop.description}</p>
            </Card>
          )}

          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">Where we deliver</h2>
              <span className="text-sm text-muted-foreground">Up to {shop.deliveryRadiusKm} km from the shop</span>
            </div>
            <LocationMap value={shop.location} label={`Map showing ${shop.name}`} className="h-64" />
            <p className="text-sm text-muted-foreground">📍 {address}</p>
          </Card>

          <section aria-labelledby="reviews-heading" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="reviews-heading" className="text-lg font-semibold">
                Reviews
              </h2>
              {shop.rating.count > 0 && (
                <p className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{shop.rating.average.toFixed(1)}</span>
                  <Stars rating={Math.round(shop.rating.average)} />
                  <span className="text-sm text-muted-foreground">
                    {shop.rating.count} {shop.rating.count === 1 ? "review" : "reviews"}
                  </span>
                </p>
              )}
            </div>
            {shop.reviews.length === 0 ? (
              <Card className="text-sm text-muted-foreground">No reviews yet. Reviews come from customers who ordered here.</Card>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {shop.reviews.map((r) => (
                  <li key={r.id}>
                    <Card className="flex h-full flex-col gap-2 p-4">
                      <div className="flex items-center gap-3">
                        <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                          {r.authorName.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{r.authorName}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</p>
                        </div>
                        <Stars rating={r.rating} />
                      </div>
                      {r.comment && <p className="text-sm">{r.comment}</p>}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-warning" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(rating)}
      <span className="text-border">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

function ShopSkeleton() {
  return (
    <div className="mt-4 flex flex-col gap-6" aria-busy>
      <div className="h-56 animate-pulse rounded-2xl bg-muted" />
      <div className="grid gap-6 lg:grid-cols-3">
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
    </div>
  );
}
