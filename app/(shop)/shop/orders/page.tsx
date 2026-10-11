import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteButton } from "@/components/ui/delete-button";
import { Pagination } from "@/components/ui/pagination";
import { requireShopkeeperShop } from "@/lib/auth/shopkeeper";
import { formatDateTime, formatPrice } from "@/lib/catalog";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/orders/status";
import { listShopOrders } from "@/lib/services/shop-orders";
import { cn } from "@/lib/utils";
import { orderListQuerySchema } from "@/lib/validation/shopkeeper";

export const metadata: Metadata = { title: "Orders" };

const TABS: { status?: OrderStatus; label: string }[] = [
  { label: "All" },
  { status: "pending", label: ORDER_STATUS_LABELS.pending },
  { status: "confirmed", label: ORDER_STATUS_LABELS.confirmed },
  { status: "out_for_delivery", label: ORDER_STATUS_LABELS.out_for_delivery },
  { status: "delivered", label: ORDER_STATUS_LABELS.delivered },
  { status: "rejected", label: ORDER_STATUS_LABELS.rejected },
  { status: "cancelled", label: ORDER_STATUS_LABELS.cancelled },
];

export default function OrdersPage({ searchParams }: PageProps<"/shop/orders">) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Orders</h1>
        <DeleteButton
          endpoint="/api/shopkeeper/orders"
          variant="link"
          label="Clear finished orders"
          confirmTitle="Clear finished orders from your list?"
          confirmMessage="Delivered, rejected and cancelled orders are removed from this list. They still count in Sales & reports, and customers keep their copies."
          confirmLabel="Clear list"
        />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <OrdersContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function OrdersContent({ searchParams }: { searchParams: PageProps<"/shop/orders">["searchParams"] }) {
  const { shop } = await requireShopkeeperShop("/shop/orders");
  const parsed = orderListQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : orderListQuerySchema.parse({});
  const result = await listShopOrders(shop, query);

  const hrefFor = (page: number) => {
    const qs = new URLSearchParams();
    if (query.status) qs.set("status", query.status);
    qs.set("page", String(page));
    return `/shop/orders?${qs}`;
  };

  return (
    <>
      <nav aria-label="Filter by status" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex gap-1">
          {TABS.map((tab) => {
            const active = query.status === tab.status;
            return (
              <li key={tab.label}>
                <Link
                  href={tab.status ? `/shop/orders?status=${tab.status}` : "/shop/orders"}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium",
                    active ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {result.items.length === 0 ? (
        <EmptyState
          title={query.status ? `No ${ORDER_STATUS_LABELS[query.status].toLowerCase()} orders` : "No orders yet"}
          description="Orders from customers will appear here."
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {result.items.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/shop/orders/${o.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-muted/50"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{o.orderNumber}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {o.contactName} · {o.place} · {o.itemCount} {o.itemCount === 1 ? "item" : "items"}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</span>
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
      <Pagination page={result.page} totalPages={result.totalPages} hrefFor={hrefFor} />
    </>
  );
}
