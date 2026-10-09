import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime, formatPrice } from "@/lib/catalog";
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "@/lib/orders/status";
import { listAdminOrders } from "@/lib/services/admin/orders";
import { adminOrderListSchema } from "@/lib/validation/admin";

export const metadata: Metadata = { title: "Orders · Admin" };

export default function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Orders</h1>
      <Suspense fallback={<PageSkeleton />}>
        <OrdersContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function OrdersContent({ searchParams }: { searchParams: PageProps<"/admin/orders">["searchParams"] }) {
  await requireRole(["admin"], "/admin/orders");
  const parsed = adminOrderListSchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : adminOrderListSchema.parse({});
  const result = await listAdminOrders(query);

  const href = (over: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    const merged = { status: query.status, shopId: query.shopId, q: query.q, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
    const s = qs.toString();
    return s ? `/admin/orders?${s}` : "/admin/orders";
  };

  return (
    <>
      <FilterTabs
        label="Filter by status"
        tabs={[
          { label: "All", href: href({ status: undefined }), active: !query.status },
          ...ORDER_STATUSES.map((s) => ({ label: ORDER_STATUS_LABELS[s], href: href({ status: s }), active: query.status === s })),
        ]}
      />
      <form action="/admin/orders" className="flex gap-2">
        {query.status && <input type="hidden" name="status" value={query.status} />}
        {query.shopId && <input type="hidden" name="shopId" value={query.shopId} />}
        <Input name="q" type="search" placeholder="Order number, e.g. AQ-7K2M" defaultValue={query.q ?? ""} aria-label="Search by order number" />
        <button type="submit" className={buttonClasses({ variant: "secondary" })}>
          Search
        </button>
      </form>
      {query.shopId && (
        <p className="text-sm text-muted-foreground">
          Showing one shop&apos;s orders.{" "}
          <Link href={href({ shopId: undefined })} className="text-primary hover:underline">
            Show all shops
          </Link>
        </p>
      )}

      {result.items.length === 0 ? (
        <EmptyState title="No orders found" />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {result.items.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-muted/50">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{o.orderNumber}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {o.shop?.name ?? "Deleted shop"} → {o.customerName}
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
      <Pagination page={result.page} totalPages={result.totalPages} hrefFor={(p) => href({ page: String(p) })} />
    </>
  );
}
