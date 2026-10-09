import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/customer/checkout-form";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/lib/auth/session";
import { formatPrice } from "@/lib/catalog";
import { decodeCart } from "@/lib/orders/cart";
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
  const itemsParam = typeof raw.items === "string" ? raw.items : "";
  const returnPath = `/account/checkout?shop=${encodeURIComponent(shopParam)}&items=${itemsParam}`;
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

  const cart = decodeCart(itemsParam);
  const byId = new Map(shop.products.map((p) => [p.id, p]));
  const lines = cart.flatMap((c) => {
    const p = byId.get(c.productId);
    return p ? [{ ...c, product: p }] : [];
  });
  const unavailable = lines.filter((l) => !l.product.inStock);
  const missing = cart.length - lines.length;

  if (lines.length === 0) {
    return (
      <EmptyState
        title="Your order is empty"
        description="Pick some products from the shop first."
        action={<Link href={`/shops/${shop.slug}`} className={buttonClasses()}>Back to {shop.name}</Link>}
      />
    );
  }

  const [addresses, profile] = await Promise.all([listAddresses(user.id), getProfile(user.id)]);
  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        {unavailable.length > 0 || missing > 0 ? (
          <Card className="flex flex-col items-start gap-3 border-danger">
            <CardTitle>Some items aren&apos;t available</CardTitle>
            <p className="text-sm text-muted-foreground">
              {unavailable.map((l) => l.product.name).join(", ") || "Some products"} can&apos;t be ordered right now.
              Please update your order.
            </p>
            <Link href={`/shops/${shop.slug}`} className={buttonClasses()}>
              Update order
            </Link>
          </Card>
        ) : (
          <CheckoutForm
            shop={{ slug: shop.slug, name: shop.name, location: shop.location, deliveryRadiusKm: shop.deliveryRadiusKm }}
            items={lines.map((l) => ({ productId: l.productId, quantity: l.quantity }))}
            addresses={addresses}
            defaultPhone={profile?.phone ?? ""}
            returnPath={returnPath}
          />
        )}
      </div>

      <Card className="flex h-fit flex-col gap-3 lg:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{shop.name}</CardTitle>
          <Link href={`/shops/${shop.slug}`} className="text-sm font-medium text-primary hover:underline">
            Edit
          </Link>
        </div>
        <ul className="divide-y divide-border text-sm">
          {lines.map((l) => (
            <li key={l.productId} className="flex justify-between gap-3 py-2">
              <span>
                {l.quantity} × {l.product.name}
              </span>
              <span className="font-medium">{formatPrice(l.product.price * l.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-2 gap-y-1 border-t border-border pt-3 text-sm">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="text-right">{formatPrice(subtotal)}</dd>
          <dt className="text-muted-foreground">Delivery</dt>
          <dd className="text-right">{shop.deliveryFee === 0 ? "Free" : formatPrice(shop.deliveryFee)}</dd>
          <dt className="font-semibold">Total</dt>
          <dd className="text-right font-semibold">{formatPrice(subtotal + shop.deliveryFee)}</dd>
        </dl>
      </Card>
    </div>
  );
}
