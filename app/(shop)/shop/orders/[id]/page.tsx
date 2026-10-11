import type { Metadata } from "next";
import Link from "next/link";
import { DeleteButton } from "@/components/ui/delete-button";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { OrderActions } from "@/components/shopkeeper/order-actions";
import { StarCustomerToggle } from "@/components/shopkeeper/star-customer-toggle";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Card, CardTitle } from "@/components/ui/card";
import { IdChip } from "@/components/ui/id-chip";
import { requireShopkeeperShop } from "@/lib/auth/shopkeeper";
import { formatDateTime, formatPrice, PRODUCT_TYPE_LABELS } from "@/lib/catalog";
import { ORDER_STATUS_LABELS } from "@/lib/orders/status";
import { getShopOrder } from "@/lib/services/shop-orders";

export const metadata: Metadata = { title: "Order details" };

export default function OrderPage({ params }: PageProps<"/shop/orders/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrderDetail params={params} />
    </Suspense>
  );
}

async function OrderDetail({ params }: { params: PageProps<"/shop/orders/[id]">["params"] }) {
  const { id } = await params;
  const { shop } = await requireShopkeeperShop(`/shop/orders/${id}`);
  const order = await getShopOrder(shop, id);
  if (!order) notFound();

  const address = [order.deliveryAddress.line1, order.deliveryAddress.area, order.deliveryAddress.city]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/shop/orders" className="text-sm text-muted-foreground hover:text-foreground">
          ← Orders
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-sm text-muted-foreground">Placed {formatDateTime(order.createdAt)}</p>
        {order.nextStatuses.length === 0 && (
          <DeleteButton
            endpoint={`/api/shopkeeper/orders/${order.id}`}
            variant="link"
            label="Remove from order list"
            confirmTitle="Remove this order from your list?"
            confirmMessage="It disappears from Orders but still counts in your sales reports. The customer keeps their copy."
            confirmLabel="Remove"
            redirectTo="/shop/orders"
            className="mt-2"
          />
        )}
      </div>

      {order.nextStatuses.length > 0 && (
        <Card>
          <OrderActions orderId={order.id} nextStatuses={order.nextStatuses} />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col gap-3 lg:col-span-2">
          <CardTitle>Items</CardTitle>
          <ul className="divide-y divide-border">
            {order.items.map((item, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="font-medium">{item.name}</span>
                  <span className="block text-muted-foreground">
                    {PRODUCT_TYPE_LABELS[item.type]}
                    {item.sizeLiters !== null && ` · ${item.sizeLiters} L`} · {item.quantity} × {formatPrice(item.unitPrice)}
                  </span>
                </span>
                <span className="font-medium">{formatPrice(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-2 gap-y-1 border-t border-border pt-3 text-sm">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="text-right">{formatPrice(order.subtotal)}</dd>
            <dt className="text-muted-foreground">Delivery</dt>
            <dd className="text-right">{order.deliveryFee === 0 ? "Free" : formatPrice(order.deliveryFee)}</dd>
            <dt className="font-semibold">Total</dt>
            <dd className="text-right font-semibold">{formatPrice(order.total)}</dd>
            <dt className="text-muted-foreground">Payment</dt>
            <dd className="text-right">
              Cash on delivery · {order.payment.status === "paid" ? "Paid" : "Unpaid"}
            </dd>
          </dl>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-2 text-sm">
            <CardTitle>Deliver to</CardTitle>
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {order.contactName}
              <IdChip id={order.customerPublicId} />
            </p>
            {order.customerPublicId && <StarCustomerToggle orderId={order.id} initial={order.isStarCustomer} />}
            <a href={`tel:${order.contactPhone}`} className="text-primary hover:underline">
              {order.contactPhone}
            </a>
            <p>{address}</p>
            {order.deliveryAddress.notes && <p className="text-muted-foreground">Note: {order.deliveryAddress.notes}</p>}
          </Card>

          <Card className="flex flex-col gap-2 text-sm">
            <CardTitle>History</CardTitle>
            <ol className="flex flex-col gap-2">
              {order.history.map((h, i) => (
                <li key={i}>
                  <span className="font-medium">{ORDER_STATUS_LABELS[h.status]}</span>
                  <span className="text-muted-foreground"> · {formatDateTime(h.at)}</span>
                  {h.note && <span className="block text-muted-foreground">“{h.note}”</span>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
