import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDistance, formatPrice, PRODUCT_TYPE_LABELS } from "@/lib/catalog";
import type { ShopSummary } from "@/lib/services/shops";
import { Rating } from "./rating";

export function ShopCard({ shop }: { shop: ShopSummary }) {
  const place = [shop.area, shop.city].filter(Boolean).join(", ");
  return (
    <Card className="relative flex flex-col gap-3 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">
            {/* Stretched link: the whole card is clickable. */}
            <Link href={`/shops/${shop.slug}`} className="after:absolute after:inset-0 hover:text-primary">
              {shop.name}
            </Link>
          </h3>
          <p className="truncate text-sm text-muted-foreground">{place}</p>
        </div>
        {shop.distanceKm !== null && (
          <span className="shrink-0 text-sm font-medium text-primary">{formatDistance(shop.distanceKm)}</span>
        )}
      </div>

      <Rating average={shop.rating.average} count={shop.rating.count} />

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
