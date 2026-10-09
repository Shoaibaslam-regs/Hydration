import type { Metadata } from "next";
import { Suspense } from "react";
import { DailyBarChart } from "@/components/charts/daily-bar-chart";
import { percentChange, StatTile } from "@/components/charts/stat-tile";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { requireShopkeeperShop } from "@/lib/auth/shopkeeper";
import { formatPrice, PRODUCT_TYPE_LABELS, TIME_ZONE } from "@/lib/catalog";
import { ORDER_STATUSES } from "@/lib/orders/status";
import { getSalesAnalytics } from "@/lib/services/analytics";
import { analyticsRangeSchema } from "@/lib/validation/admin";

export const metadata: Metadata = { title: "Sales & reports" };

export default function ShopReportsPage({ searchParams }: PageProps<"/shop/reports">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Sales & reports</h1>
      <Suspense fallback={<PageSkeleton />}>
        <ReportsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ReportsContent({ searchParams }: { searchParams: PageProps<"/shop/reports">["searchParams"] }) {
  const { shop } = await requireShopkeeperShop("/shop/reports");
  const parsed = analyticsRangeSchema.safeParse(await searchParams);
  const days = parsed.success ? parsed.data.days : 30;
  const a = await getSalesAnalytics(days, shop.id);
  const t = a.totals;
  const period = `vs previous ${days} days`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label="Time range"
          tabs={[7, 30, 90].map((d) => ({ label: `Last ${d} days`, href: `/shop/reports?days=${d}`, active: d === days }))}
        />
        <a href={`/api/shopkeeper/reports/export?days=${days}`} download className={buttonClasses({ variant: "secondary", size: "sm" })}>
          ⬇ Download orders (CSV)
        </a>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StatTile
          hero
          label="Sales (delivered orders)"
          value={formatPrice(t.deliveredValue)}
          delta={percentChange(t.deliveredValue, a.previous.deliveredValue)}
          deltaLabel={period}
        />
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <StatTile label="Orders received" value={t.orders.toLocaleString("en")} delta={percentChange(t.orders, a.previous.orders)} deltaLabel={period} />
          <StatTile label="Average delivered order" value={formatPrice(t.avgOrderValue)} />
          <StatTile label="Units delivered" value={t.itemsSold.toLocaleString("en")} />
          <StatTile label="Rejected or cancelled" value={t.orders ? `${Math.round((t.failed / t.orders) * 100)}%` : "—"} />
        </div>
      </div>

      <Card className="flex flex-col gap-4">
        <div>
          <CardTitle>Sales per day</CardTitle>
          <CardDescription>Delivered order value by order date ({TIME_ZONE}). Hover or focus a day for details.</CardDescription>
        </div>
        <DailyBarChart
          label={`Sales per day, last ${days} days`}
          data={a.daily.map((d) => ({ date: d.date, value: d.deliveredValue, orders: d.orders }))}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <CardTitle>Best-selling products</CardTitle>
          {a.topProducts.length === 0 ? (
            <CardDescription>No delivered orders in this period yet.</CardDescription>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 font-medium">Product</th>
                  <th className="py-1 text-right font-medium">Units</th>
                  <th className="py-1 text-right font-medium">Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {a.topProducts.map((p) => (
                  <tr key={`${p.name}:${p.type}`}>
                    <td className="py-2">
                      {p.name}
                      <span className="block text-xs text-muted-foreground">{PRODUCT_TYPE_LABELS[p.type]}</span>
                    </td>
                    <td className="py-2 text-right">{p.units}</td>
                    <td className="py-2 text-right">{formatPrice(p.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <CardTitle>Orders by status</CardTitle>
          <ul className="flex flex-col gap-2 text-sm">
            {ORDER_STATUSES.map((s) => (
              <li key={s} className="flex items-center justify-between gap-3">
                <OrderStatusBadge status={s} />
                <span className="tabular-nums">{a.byStatus[s]}</span>
              </li>
            ))}
          </ul>
          <CardDescription>
            Delivery fees collected: {formatPrice(t.deliveryFees)}. Sales include delivery fees.
          </CardDescription>
        </Card>
      </div>
    </>
  );
}
