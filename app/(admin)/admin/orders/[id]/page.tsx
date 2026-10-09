import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminActions } from "@/components/admin/admin-actions";
import { AuditLog } from "@/components/admin/audit-log";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime, formatPrice } from "@/lib/catalog";
import { ORDER_STATUS_LABELS } from "@/lib/orders/status";
import { getAdminOrder } from "@/lib/services/admin/orders";

export const metadata: Metadata = { title: "Order · Admin" };

export default function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrderDetail params={params} />
    </Suspense>
  );
}

async function OrderDetail({ params }: { params: PageProps<"/admin/orders/[id]">["params"] }) {
  const { id } = await params;
  await requireRole(["admin"], `/admin/orders/${id}`);
  const order = await getAdminOrder(id);
  if (!order) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/orders" className="text-sm text-muted-foreground hover:text-foreground">
          ← Orders
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-sm text-muted-foreground">Placed {formatDateTime(order.createdAt)}</p>
      </div>

      {order.canCancel && (
        <Card className="flex flex-col gap-3">
          <CardTitle>Intervene</CardTitle>
          <CardDescription>Cancel this order on behalf of the platform (e.g. a dispute). Stock is returned to the shop.</CardDescription>
          <AdminActions
            endpoint={`/api/admin/orders/${order.id}`}
            actions={[{ label: "Cancel order", body: {}, needsReason: true, danger: true }]}
            reasonHint="Shown to the customer and the shop in the order history."
          />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col gap-3 lg:col-span-2">
          <CardTitle>Items</CardTitle>
          <ul className="divide-y divide-border text-sm">
            {order.items.map((i, n) => (
              <li key={n} className="flex justify-between gap-3 py-2">
                <span>
                  {i.quantity} × {i.name}
                </span>
                <span className="font-medium">{formatPrice(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-2 gap-y-1 border-t border-border pt-3 text-sm">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="text-right">{formatPrice(order.subtotal)}</dd>
            <dt className="text-muted-foreground">Delivery</dt>
            <dd className="text-right">{formatPrice(order.deliveryFee)}</dd>
            <dt className="font-semibold">Total</dt>
            <dd className="text-right font-semibold">{formatPrice(order.total)}</dd>
            <dt className="text-muted-foreground">Payment</dt>
            <dd className="text-right">Cash on delivery · {order.payment.status}</dd>
          </dl>
        </Card>
        <Card className="flex flex-col gap-2 text-sm">
          <CardTitle>People</CardTitle>
          <p>
            <span className="text-muted-foreground">Shop: </span>
            {order.shop ? (
              <Link href={`/admin/shops/${order.shop.id}`} className="text-primary hover:underline">
                {order.shop.name}
              </Link>
            ) : (
              "Deleted shop"
            )}
          </p>
          <p>
            <span className="text-muted-foreground">Customer: </span>
            {order.customer ? (
              <Link href={`/admin/users/${order.customer.id}`} className="text-primary hover:underline">
                {order.customer.name}
              </Link>
            ) : (
              order.customerName
            )}
          </p>
          <p className="text-muted-foreground">{order.contactPhone}</p>
          <p className="text-muted-foreground">{order.deliveryAddress}</p>
        </Card>
      </div>

      <Card className="flex flex-col gap-2 text-sm">
        <CardTitle>Status history</CardTitle>
        <ol className="flex flex-col gap-2">
          {order.history.map((h, n) => (
            <li key={n}>
              <span className="font-medium">{ORDER_STATUS_LABELS[h.status]}</span>
              <span className="text-muted-foreground">
                {" "}
                · by {h.by} · {formatDateTime(h.at)}
              </span>
              {h.note && <span className="block text-muted-foreground">“{h.note}”</span>}
            </li>
          ))}
        </ol>
      </Card>
      <AuditLog entries={order.adminHistory} />
    </div>
  );
}
