import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDistance, formatPrice, PRODUCT_TYPE_LABELS } from "@/lib/catalog";
import type { ShopSummary } from "@/lib/services/shops";
import { DealTag } from "@/components/ads/deal-tag";
import { cn } from "@/lib/utils";
import { Rating } from "./rating";
import { VerifiedBadge } from "./verified-badge";

/**
 * A shop in a list. `sponsored` cards are labelled and link through the click
 * counter; that link is a plain <a> so it's never prefetched (which would count
 * clicks nobody made).
 */
export function ShopCard({ shop, sponsored = false }: { shop: ShopSummary; sponsored?: boolean }) {
  const place = [shop.area, shop.city].filter(Boolean).join(", ");
  const linkClass = "truncate after:absolute after:inset-0 hover:text-primary";
  return (
    <Card className={cn("relative flex flex-col gap-3 transition-shadow hover:shadow-md", sponsored && "border-primary/40")}>
      {sponsored && (
        <span className="-mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Sponsored</span>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex min-w-0 items-center gap-1.5 font-semibold">
            {/* Stretched link: the whole card is clickable. */}
            {sponsored ? (
              <a href={`/api/ads/click?kind=sponsored&id=${shop.id}`} className={linkClass}>
                {shop.name}
              </a>
            ) : (
              <Link href={`/shops/${shop.slug}`} className={linkClass}>
                {shop.name}
              </Link>
            )}
            {shop.hasVerifiedBadge && <VerifiedBadge compact />}
          </h3>
          <p className="truncate text-sm text-muted-foreground">{place}</p>
        </div>
        {shop.isClosed && <Badge tone="danger">Closed</Badge>}
        {shop.distanceKm !== null && (
          <span className="shrink-0 text-sm font-medium text-primary">{formatDistance(shop.distanceKm)}</span>
        )}
      </div>

      <Rating average={shop.rating.average} count={shop.rating.count} />

      {shop.deal && <DealTag title={shop.deal.title} />}

      <div className="flex flex-wrap gap-1.5">
        {shop.productTypes.map((type) => (
          <Badge key={type} tone="info">
            {PRODUCT_TYPE_LABELS[type]}
          </Badge>
        ))}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
        <span>
          {shop.minPrice !== null && (
            <>
              From <span className="font-semibold">{formatPrice(shop.minPrice)}</span>
            </>
          )}
        </span>
        <span className="text-muted-foreground">
          {shop.deliveryFee === 0 ? "Free delivery" : `Delivery ${formatPrice(shop.deliveryFee)}`} · {shop.hours.opensAt}–
          {shop.hours.closesAt}
        </span>
      </div>
    </Card>
  );
}
