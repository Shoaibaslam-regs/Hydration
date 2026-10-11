import Link from "next/link";
import { AdChip } from "@/components/ads/ad-chip";
import { DealTag } from "@/components/ads/deal-tag";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CAN_SIZE_LITERS, formatDistance, formatPrice } from "@/lib/catalog";
import type { ShopSummary } from "@/lib/services/shops";
import { cn } from "@/lib/utils";
import { isOpenAt } from "@/lib/shops/hours";
import { HoursPill } from "./hours-status";
import { Rating } from "./rating";
import { ShopAvatar } from "./shop-avatar";
import { StarShopBadge } from "./star-badge";
import { VerifiedBadge } from "./verified-badge";

/**
 * A shop in a list. Sponsored cards get the premium (gold) treatment and link
 * through the click counter; that link is a plain <a> so it's never
 * prefetched (which would count clicks nobody made).
 */
export function ShopCard({ shop, sponsored = false }: { shop: ShopSummary; sponsored?: boolean }) {
  return sponsored ? <SponsoredShopCard shop={shop} /> : <RegularShopCard shop={shop} />;
}

const place = (shop: ShopSummary) => [shop.area, shop.city].filter(Boolean).join(", ");
const delivery = (shop: ShopSummary) => (shop.deliveryFee === 0 ? "Free delivery" : `Delivery ${formatPrice(shop.deliveryFee)}`);
// Stretched link: the whole card is clickable.
const stretched = "after:absolute after:inset-0 after:rounded-xl";

function RegularShopCard({ shop }: { shop: ShopSummary }) {
  return (
    <Card className="relative flex flex-col gap-3 transition-shadow hover:border-primary/40 hover:shadow-md">
      <div className="flex items-start gap-3">
        <ShopAvatar name={shop.name} size="sm" />
        <div className="min-w-0 flex-1">
          <h3 className="flex min-w-0 items-center gap-1.5 font-semibold">
            <Link href={`/shops/${shop.slug}`} className={cn("truncate hover:text-primary", stretched)}>
              {shop.name}
            </Link>
            {shop.hasVerifiedBadge && <VerifiedBadge compact />}
          </h3>
          <p className="truncate text-sm text-muted-foreground">{place(shop)}</p>
        </div>
        {shop.isClosed && <Badge tone="danger">Closed</Badge>}
        {shop.distanceKm !== null && <span className="shrink-0 text-sm font-medium text-primary">{formatDistance(shop.distanceKm)}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Rating average={shop.rating.average} count={shop.rating.count} />
        {shop.hasStarAward && <StarShopBadge compact />}
        {!shop.isClosed && <HoursPill open={isOpenAt(shop.hours, new Date())} hours={shop.hours} size="sm" />}
      </div>
      {shop.deal && <DealTag title={shop.deal.title} />}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
        <span>
          {shop.pricePerCan !== null && (
            <>
              <span className="font-semibold">{formatPrice(shop.pricePerCan)}</span> / {CAN_SIZE_LITERS}L can
            </>
          )}
        </span>
        <span className="text-muted-foreground">
          {delivery(shop)} · {shop.hours.opensAt}–{shop.hours.closesAt}
        </span>
      </div>
    </Card>
  );
}

function SponsoredShopCard({ shop }: { shop: ShopSummary }) {
  return (
    <div
      className={cn(
        "group relative flex h-full flex-col gap-4 overflow-hidden rounded-xl border-2 border-premium/50 p-5 shadow-sm transition-shadow",
        "bg-gradient-to-br from-premium-soft via-card to-card hover:border-premium hover:shadow-lg",
      )}
    >
      {/* Soft gold glow in the corner, purely decorative. */}
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-premium/15 blur-2xl" />

      <div className="relative flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-premium px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-premium-foreground">
            <span aria-hidden>★</span> Sponsored
          </span>
          <AdChip className="text-premium" />
        </span>
        {shop.distanceKm !== null && (
          <span className="rounded-full bg-background/70 px-2 py-0.5 text-sm font-semibold text-premium ring-1 ring-premium/30">
            {formatDistance(shop.distanceKm)}
          </span>
        )}
      </div>

      <div className="relative flex items-start gap-3">
        <ShopAvatar name={shop.name} premium />
        <div className="min-w-0 flex-1">
          <h3 className="flex min-w-0 items-center gap-1.5 text-lg font-bold">
            <a href={`/api/ads/click?kind=sponsored&id=${shop.id}`} className={cn("truncate", stretched)}>
              {shop.name}
            </a>
            {shop.hasVerifiedBadge && <VerifiedBadge compact />}
          </h3>
          <p className="truncate text-sm text-muted-foreground">{place(shop)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Rating average={shop.rating.average} count={shop.rating.count} />
            {shop.hasStarAward && <StarShopBadge compact />}
            {!shop.isClosed && <HoursPill open={isOpenAt(shop.hours, new Date())} hours={shop.hours} size="sm" />}
          </div>
        </div>
      </div>

      {shop.deal && <DealTag title={shop.deal.title} />}

      <div className="relative mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-premium/25 pt-4">
        <div>
          {shop.pricePerCan !== null && (
            <p>
              <span className="text-2xl font-bold">{formatPrice(shop.pricePerCan)}</span>
              <span className="text-sm text-muted-foreground"> / {CAN_SIZE_LITERS}L can</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {delivery(shop)} · {shop.hours.opensAt}–{shop.hours.closesAt}
          </p>
        </div>
        {/* Looks like a button; the stretched link above makes the whole card clickable. */}
        <span
          aria-hidden
          className="inline-flex h-9 items-center gap-1 rounded-lg bg-premium px-4 text-sm font-semibold text-premium-foreground transition-transform group-hover:translate-x-0.5"
        >
          Order now →
        </span>
      </div>
    </div>
  );
}
