import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { ShopCard } from "@/components/shops/shop-card";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime, formatPrice } from "@/lib/catalog";
import { listAddresses } from "@/lib/services/addresses";
import { listCustomerOrders } from "@/lib/services/customer-orders";
import { searchShops } from "@/lib/services/shops";
import { shopSearchSchema } from "@/lib/validation/shops";

export const metadata: Metadata = { title: "My account" };

export default function AccountPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccountOverview />
    </Suspense>
  );
}

async function AccountOverview() {
  const user = await requireRole(["customer"], "/account");
  const [addresses, orders] = await Promise.all([
    listAddresses(user.id),
    listCustomerOrders(user.id, { page: 1, limit: 3 }),
  ]);
  const home = addresses.find((a) => a.isDefault) ?? addresses[0];
  const nearby = home
    ? await searchShops(shopSearchSchema.parse({ lat: home.location.lat, lng: home.location.lng, limit: 3 }))
    : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Hi, {user.name.split(" ")[0]}</h1>

      {orders.items.length > 0 && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle>Recent orders</CardTitle>
            <Link href="/account/orders" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {orders.items.map((o) => (
              <li key={o.id}>
                <Link href={`/account/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:text-primary">
                  <span className="flex flex-col">
                    <span className="font-medium">{o.shop.name}</span>
                    <span className="text-sm text-muted-foreground">{formatDateTime(o.createdAt)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium">{formatPrice(o.total)}</span>
                    <OrderStatusBadge status={o.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{home ? `Shops near ${home.label}` : "Shops near you"}</h2>
          <Link href={home ? `/shops?lat=${home.location.lat}&lng=${home.location.lng}` : "/shops"} className="text-sm font-medium text-primary hover:underline">
            See all
          </Link>
        </div>
        {!home ? (
          <Card className="flex flex-col items-start gap-3">
            <CardDescription>Add your delivery address to see shops that deliver to you.</CardDescription>
            <Link href="/account/addresses/new" className={buttonClasses()}>
              Add address
            </Link>
          </Card>
        ) : nearby && nearby.items.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nearby.items.map((s) => (
              <ShopCard key={s.id} shop={s} />
            ))}
          </div>
        ) : (
          <Card>
            <CardDescription>No verified shops within 10 km of {home.label} yet.</CardDescription>
          </Card>
        )}
      </section>
    </div>
  );
}
