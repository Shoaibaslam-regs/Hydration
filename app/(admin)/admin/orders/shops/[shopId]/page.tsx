import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { ShopAvatar } from "@/components/shops/shop-avatar";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { IdChip } from "@/components/ui/id-chip";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime, formatPrice } from "@/lib/catalog";
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "@/lib/orders/status";
import { getShopOrderStats, listAdminOrders } from "@/lib/services/admin/orders";
import { adminOrderListSchema } from "@/lib/validation/admin";

export const metadata: Metadata = { title: "Shop orders · Admin" };

export default function AdminShopOrdersPage({ params, searchParams }: PageProps<"/admin/orders/shops/[shopId]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/orders" className="text-sm text-muted-foreground hover:text-foreground">
        ← All shops
      </Link>
      <Suspense fallback={<PageSkeleton />}>
        <ShopOrders params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ShopOrders({
  params,
  searchParams,
}: {
  params: PageProps<"/admin/orders/shops/[shopId]">["params"];
  searchParams: PageProps<"/admin/orders/shops/[shopId]">["searchParams"];
}) {
  const { shopId: id } = await params;
  await requireRole(["admin"], `/admin/orders/shops/${id}`);
  const stats = await getShopOrderStats(id);
  if (!stats) notFound();
  const parsed = adminOrderListSchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : adminOrderListSchema.parse({});
  const result = await listAdminOrders({ ...query, shopId: id });
  const name = stats.shop?.name ?? "Removed shop";
  const base = `/admin/orders/shops/${id}`;

  const href = (over: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: query.status, q: query.q, ...over })) if (v) qs.set(k, v);
    const s = qs.toString();
    return s ? `${base}?${s}` : base;
  };
  const tabCount: Partial<Record<string, number>> = { pending: stats.pending, delivered: stats.delivered };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <ShopAvatar name={name} />
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
              <span className="truncate">{name} · orders</span>
              {stats.shop && <IdChip id={stats.shop.publicId} />}
            </h1>
            <p className="text-sm text-muted-foreground">
              {stats.total} {stats.total === 1 ? "order" : "orders"} · {formatPrice(stats.deliveredValue)} delivered
              {stats.shop && (
                <>
                  {" · "}
                  <Link href={`/admin/shops/${id}`} className="text-primary hover:underline">
                    Shop details
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["New", stats.pending, stats.pending > 0],
          ["In progress", stats.active, false],
          ["Delivered", stats.delivered, false],
          ["Cancelled / rejected", stats.cancelledOrRejected, false],
        ].map(([label, value, hot]) => (
          <Card key={String(label)} className={`p-4 ${hot ? "border-warning" : ""}`}>
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-2xl font-bold">{value as number}</dd>
          </Card>
        ))}
      </dl>

      <FilterTabs
        label="Filter by status"
        tabs={[
          { label: `All (${stats.total})`, href: href({ status: undefined }), active: !query.status },
          ...ORDER_STATUSES.map((s) => ({
            label: tabCount[s] !== undefined ? `${ORDER_STATUS_LABELS[s]} (${tabCount[s]})` : ORDER_STATUS_LABELS[s],
            href: href({ status: s }),
            active: query.status === s,
          })),
        ]}
      />
      <form action={base} className="flex gap-2">
        {query.status && <input type="hidden" name="status" value={query.status} />}
        <Input name="q" type="search" placeholder="Order number, e.g. AQ-7K2M" defaultValue={query.q ?? ""} aria-label="Search this shop's orders by number" />
        <button type="submit" className={buttonClasses({ variant: "secondary" })}>
          Search
        </button>
      </form>

      {result.items.length === 0 ? (
        <EmptyState title="No orders here" />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {result.items.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-muted/50">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{o.orderNumber}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                      <span className="truncate">
                        {o.customerName} · {o.itemCount} {o.itemCount === 1 ? "can" : "cans"}
                      </span>
                      <IdChip id={o.customerPublicId} />
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
