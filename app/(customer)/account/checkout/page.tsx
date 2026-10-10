import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/customer/checkout-form";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/lib/auth/session";
import { CAN_LABEL, formatPrice } from "@/lib/catalog";
import { parseCans } from "@/lib/orders/cart";
import { listAddresses } from "@/lib/services/addresses";
import { getShopBySlug } from "@/lib/services/shops";
import { getProfile } from "@/lib/services/users";
import { shopSlugSchema } from "@/lib/validation/shops";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage({ searchParams }: PageProps<"/account/checkout">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Checkout</h1>
      <Suspense fallback={<PageSkeleton />}>
        <Checkout searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Checkout({ searchParams }: { searchParams: PageProps<"/account/checkout">["searchParams"] }) {
  const raw = await searchParams;
  const shopParam = typeof raw.shop === "string" ? raw.shop : "";
  const cans = parseCans(typeof raw.cans === "string" ? raw.cans : null);
  const returnPath = `/account/checkout?shop=${encodeURIComponent(shopParam)}&cans=${cans}`;
  const user = await requireRole(["customer"], returnPath);

  const slug = shopSlugSchema.safeParse(shopParam);
  const shop = slug.success ? await getShopBySlug(slug.data) : null;
  if (!shop) {
    return (
      <EmptyState
        title="This shop isn't available"
        description="It may have stopped taking orders. Find another shop nearby."
        action={<Link href="/shops" className={buttonClasses()}>Find shops</Link>}
      />
    );
  }

  const notTakingOrders = !shop.pricePerCan || !(shop.planEndsAt && new Date(shop.planEndsAt) > new Date());
  if (shop.closure || notTakingOrders) {
    return (
      <EmptyState
        title={shop.closure ? `${shop.name} is closed right now` : `${shop.name} isn't taking orders right now`}
        description="It isn't taking new orders at the moment. Find another shop nearby."
        action={<Link href="/shops" className={buttonClasses()}>Find shops</Link>}
      />
    );
  }

  const [addresses, profile] = await Promise.all([listAddresses(user.id), getProfile(user.id)]);
  const price = shop.pricePerCan!;
  const subtotal = price * cans;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <CheckoutForm
          shop={{ slug: shop.slug, name: shop.name, location: shop.location, deliveryRadiusKm: shop.deliveryRadiusKm }}
          quantity={cans}
          addresses={addresses}
          defaultPhone={profile?.phone ?? ""}
          returnPath={returnPath}
        />
      </div>

      <Card className="flex h-fit flex-col gap-3 lg:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{shop.name}</CardTitle>
          <Link href={`/shops/${shop.slug}`} className="text-sm font-medium text-primary hover:underline">
            Change
          </Link>
        </div>
        <p className="flex justify-between gap-3 text-sm">
          <span>
            {cans} × {CAN_LABEL} ({formatPrice(price)} each)
          </span>
          <span className="font-medium">{formatPrice(subtotal)}</span>
        </p>
        <dl className="grid grid-cols-2 gap-y-1 border-t border-border pt-3 text-sm">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="text-right">{formatPrice(subtotal)}</dd>
          <dt className="text-muted-foreground">Delivery</dt>
          <dd className="text-right">{shop.deliveryFee === 0 ? "Free" : formatPrice(shop.deliveryFee)}</dd>
          <dt className="font-semibold">Total</dt>
          <dd className="text-right font-semibold">{formatPrice(subtotal + shop.deliveryFee)}</dd>
        </dl>
        <p className="text-xs text-muted-foreground">Pay cash on delivery.</p>
      </Card>
    </div>
  );
}
