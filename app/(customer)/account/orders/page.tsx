import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { NotificationDot } from "@/components/notifications/count-badge";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime, formatPrice } from "@/lib/catalog";
import { FINAL_ORDER_STATUSES } from "@/lib/orders/status";
import { listCustomerOrders } from "@/lib/services/customer-orders";
import { customerOrderListSchema } from "@/lib/validation/customer";

export const metadata: Metadata = { title: "My orders" };

export default function CustomerOrdersPage({ searchParams }: PageProps<"/account/orders">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">My orders</h1>
      <Suspense fallback={<PageSkeleton />}>
        <OrdersContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function OrdersContent({ searchParams }: { searchParams: PageProps<"/account/orders">["searchParams"] }) {
  const user = await requireRole(["customer"], "/account/orders");
  const parsed = customerOrderListSchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : customerOrderListSchema.parse({});
  const result = await listCustomerOrders(user.id, query);

  if (result.total === 0) {
    return (
      <EmptyState
        title="No orders yet"
        description="Find a shop near you and order your first delivery."
        action={<Link href="/shops" className={buttonClasses()}>Find shops</Link>}
      />
    );
  }

  return (
    <>
      <div className="flex justify-end">
        <DeleteButton
          endpoint="/api/customer/orders"
          variant="link"
          label="Clear finished orders"
          confirmTitle="Clear finished orders from your history?"
          confirmMessage="Delivered, cancelled and rejected orders are removed from your list. Orders still on their way stay. The shop keeps its own records."
          confirmLabel="Clear history"
        />
      </div>
      <Card className="p-0">
        <ul className="divide-y divide-border">
          {result.items.map((o) => (
            <li key={o.id} className="flex items-center gap-1 pr-3">
              <Link href={`/account/orders/${o.id}`} className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-muted/50">
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2 font-medium">
                    {o.shop.name}
                    {o.unread && <NotificationDot label="Updated" />}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {o.orderNumber} · {o.itemCount} {o.itemCount === 1 ? "can" : "cans"} · {formatDateTime(o.createdAt)}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold">{formatPrice(o.total)}</span>
                  <OrderStatusBadge status={o.status} />
                </span>
              </Link>
              {FINAL_ORDER_STATUSES.includes(o.status) ? (
                <DeleteButton
                  endpoint={`/api/customer/orders/${o.id}`}
                  variant="icon"
                  label={`Remove order ${o.orderNumber} from your history`}
                  confirmTitle="Remove this order from your history?"
                  confirmMessage="The shop keeps its own record of it."
                  confirmLabel="Remove"
                />
              ) : (
                <span className="size-7 shrink-0" aria-hidden />
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Pagination page={result.page} totalPages={result.totalPages} hrefFor={(p) => `/account/orders?page=${p}`} />
    </>
  );
}
