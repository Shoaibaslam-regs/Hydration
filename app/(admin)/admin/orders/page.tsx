import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { ShopAvatar } from "@/components/shops/shop-avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { IdChip } from "@/components/ui/id-chip";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime, formatPrice } from "@/lib/catalog";
import { listAdminOrders, listShopOrderStats } from "@/lib/services/admin/orders";
import { adminOrderShopsSchema } from "@/lib/validation/admin";

export const metadata: Metadata = { title: "Orders · Admin" };

export default function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-muted-foreground">Pick a shop to see and manage its orders. Shops with orders waiting come first.</p>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <OrdersByShop searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function OrdersByShop({ searchParams }: { searchParams: PageProps<"/admin/orders">["searchParams"] }) {
  await requireRole(["admin"], "/admin/orders");
  const parsed = adminOrderShopsSchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : adminOrderShopsSchema.parse({});
  // Looking up one order by its number skips the shop list.
  const [shops, found] = await Promise.all([
    query.order ? null : listShopOrderStats(query),
    query.order ? listAdminOrders({ page: 1, limit: 20, q: query.order }) : null,
  ]);

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <form action="/admin/orders" className="flex gap-2">
          <Input name="q" type="search" placeholder="Find a shop by name, area, city or ID" defaultValue={query.q ?? ""} aria-label="Find a shop" />
          <button type="submit" className={buttonClasses({ variant: "secondary", className: "shrink-0 whitespace-nowrap" })}>
            Find shop
          </button>
        </form>
        <form action="/admin/orders" className="flex gap-2">
          <Input name="order" type="search" placeholder="Order number, e.g. AQ-7K2M" defaultValue={query.order ?? ""} aria-label="Find an order by number" />
          <button type="submit" className={buttonClasses({ variant: "secondary", className: "shrink-0 whitespace-nowrap" })}>
            Find order
          </button>
        </form>
      </div>

      {found && (
        <section aria-label="Orders found" className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Orders starting with “{query.order}”.{" "}
            <Link href="/admin/orders" className="text-primary hover:underline">
              Back to shops
            </Link>
          </p>
          {found.items.length === 0 ? (
            <EmptyState title="No order with that number" />
          ) : (
            <Card className="p-0">
              <ul className="divide-y divide-border">
                {found.items.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-muted/50">
                      <span className="flex min-w-0 flex-col">
                        <span className="font-medium">{o.orderNumber}</span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                          <span className="truncate">
                            {o.shop?.name ?? "Removed shop"} → {o.customerName} · {formatDateTime(o.createdAt)}
                          </span>
                          <IdChip id={o.customerPublicId} />
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="font-semibold">{formatPrice(o.total)}</span>
                        <OrderStatusBadge status={o.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      )}

      {shops &&
        (shops.items.length === 0 ? (
          <EmptyState title={query.q ? "No shops with orders match that" : "No orders yet"} />
        ) : (
          <>
            <ul className="grid gap-3 md:grid-cols-2">
              {shops.items.map((s) => (
                <li key={s.shopId}>
                  <Link
                    href={`/admin/orders/shops/${s.shopId}`}
                    className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:border-primary/40 hover:shadow-md"
                  >
                    <span className="flex items-start gap-3">
                      <ShopAvatar name={s.shop?.name ?? "Removed shop"} size="sm" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-semibold">{s.shop?.name ?? "Removed shop"}</span>
                          {s.shop && <IdChip id={s.shop.publicId} />}
                        </span>
                        <span className="truncate text-sm text-muted-foreground">
                          {s.shop ? [s.shop.area, s.shop.city].filter(Boolean).join(", ") : "Its past orders are kept"}
                        </span>
                      </span>
                      {s.pending > 0 && <Badge tone="warning">{s.pending} new</Badge>}
                    </span>
                    <span className="grid grid-cols-4 gap-2 text-center text-xs">
                      <Stat label="New" value={s.pending} highlight={s.pending > 0} />
                      <Stat label="In progress" value={s.active} />
                      <Stat label="Delivered" value={s.delivered} />
                      <Stat label="Total" value={s.total} />
                    </span>
                    <span className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                      <span>Delivered value {formatPrice(s.deliveredValue)}</span>
                      <span>Last order {formatDateTime(s.lastOrderAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination
              page={shops.page}
              totalPages={shops.totalPages}
              hrefFor={(p) => `/admin/orders?${new URLSearchParams({ ...(query.q && { q: query.q }), page: String(p) })}`}
            />
          </>
        ))}
    </>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <span className={`flex flex-col rounded-lg py-1.5 ${highlight ? "bg-warning/15" : "bg-muted"}`}>
      <span className="text-base font-bold text-foreground">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
