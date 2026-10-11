import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CancelOrderButton, ReviewForm } from "@/components/customer/order-customer-actions";
import { DeleteButton } from "@/components/ui/delete-button";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime, formatPrice } from "@/lib/catalog";
import { ORDER_STATUS_LABELS, type OrderStatus, FINAL_ORDER_STATUSES } from "@/lib/orders/status";
import { getCustomerOrder } from "@/lib/services/customer-orders";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Order details" };

const PROGRESS: OrderStatus[] = ["pending", "confirmed", "out_for_delivery", "delivered"];

export default function CustomerOrderPage({ params, searchParams }: PageProps<"/account/orders/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrderDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function OrderDetail({
  params,
  searchParams,
}: Pick<PageProps<"/account/orders/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const user = await requireRole(["customer"], `/account/orders/${id}`);
  const order = await getCustomerOrder(user.id, id);
  if (!order) notFound();
  const justPlaced = (await searchParams).placed === "1";
  const step = PROGRESS.indexOf(order.status);
  const lastNote = [...order.history].reverse().find((h) => h.note)?.note;

  return (
    <div className="flex flex-col gap-6">
      {justPlaced && (
        <div role="status" className="rounded-xl border border-success/40 bg-success/10 p-4">
          <p className="font-semibold">Order placed!</p>
          <p className="text-sm text-muted-foreground">{order.shop.name} will confirm it shortly. You pay on delivery.</p>
        </div>
      )}

      <div>
        <Link href="/account/orders" className="text-sm text-muted-foreground hover:text-foreground">
          ← My orders
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          From{" "}
          <Link href={`/shops/${order.shop.slug}`} className="text-primary hover:underline">
            {order.shop.name}
          </Link>{" "}
          · {formatDateTime(order.createdAt)}
        </p>
      </div>

      {step >= 0 ? (
        <ol className="grid grid-cols-4 gap-2" aria-label="Order progress">
          {PROGRESS.map((s, i) => (
            <li key={s} className="flex flex-col gap-1.5">
              <span className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
              <span className={cn("text-xs", i <= step ? "font-medium" : "text-muted-foreground")} aria-current={i === step ? "step" : undefined}>
                {ORDER_STATUS_LABELS[s]}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <Card className="border-danger/40">
          <p className="font-semibold">This order was {ORDER_STATUS_LABELS[order.status].toLowerCase()}.</p>
          {lastNote && <p className="text-sm text-muted-foreground">Reason: {lastNote}</p>}
        </Card>
      )}

      {order.canCancel && <CancelOrderButton orderId={order.id} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col gap-3 lg:col-span-2">
          <CardTitle>Items</CardTitle>
          <ul className="divide-y divide-border text-sm">
            {order.items.map((item, i) => (
              <li key={i} className="flex justify-between gap-3 py-2">
                <span>
                  {item.quantity} × {item.name}
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
            <dd className="text-right">Cash on delivery · {order.payment.status === "paid" ? "Paid" : "Unpaid"}</dd>
          </dl>
        </Card>
        <Card className="flex flex-col gap-2 text-sm">
          <CardTitle>Delivery</CardTitle>
          <p>{[order.deliveryAddress.line1, order.deliveryAddress.area, order.deliveryAddress.city].filter(Boolean).join(", ")}</p>
          {order.deliveryAddress.notes && <p className="text-muted-foreground">Note: {order.deliveryAddress.notes}</p>}
          <p className="text-muted-foreground">Your phone: {order.contactPhone}</p>
          {order.shopPhone && (
            <p>
              Shop:{" "}
              <a href={`tel:${order.shopPhone}`} className="text-primary hover:underline">
                {order.shopPhone}
              </a>
            </p>
          )}
        </Card>
      </div>

      {order.review ? (
        <Card className="flex flex-col gap-1">
          <CardTitle>Your review</CardTitle>
          <p className="text-warning" aria-label={`${order.review.rating} out of 5 stars`}>
            {"★".repeat(order.review.rating)}
            <span className="text-border">{"★".repeat(5 - order.review.rating)}</span>
          </p>
          {order.review.comment && <p className="text-sm">{order.review.comment}</p>}
          <DeleteButton
            endpoint={`/api/customer/orders/${order.id}/review`}
            variant="link"
            label="Delete review"
            confirmTitle="Delete your review?"
            confirmMessage="It's removed from the shop's page and its rating is recalculated. You can write a new one afterwards."
            className="mt-1"
          />
        </Card>
      ) : (
        order.canReview && (
          <Card className="flex flex-col gap-3">
            <CardTitle>How was your order?</CardTitle>
            <ReviewForm orderId={order.id} />
          </Card>
        )
      )}

      {FINAL_ORDER_STATUSES.includes(order.status) && (
        <div>
          <DeleteButton
            endpoint={`/api/customer/orders/${order.id}`}
            variant="link"
            label="Remove from my orders"
            confirmTitle="Remove this order from your history?"
            confirmMessage="It disappears from your orders. The shop keeps its own record."
            confirmLabel="Remove"
            redirectTo="/account/orders"
          />
        </div>
      )}
    </div>
  );
}
