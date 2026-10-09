import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DailyBarChart } from "@/components/charts/daily-bar-chart";
import { percentChange, StatTile } from "@/components/charts/stat-tile";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { requireRole } from "@/lib/auth/session";
import { formatPrice, TIME_ZONE } from "@/lib/catalog";
import { getRevenueAnalytics } from "@/lib/services/analytics";
import { analyticsRangeSchema } from "@/lib/validation/admin";

export const metadata: Metadata = { title: "Revenue · Admin" };

export default function RevenuePage({ searchParams }: PageProps<"/admin/revenue">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Revenue & orders</h1>
      <Suspense fallback={<PageSkeleton />}>
        <RevenueContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function RevenueContent({ searchParams }: { searchParams: PageProps<"/admin/revenue">["searchParams"] }) {
  await requireRole(["admin"], "/admin/revenue");
  const parsed = analyticsRangeSchema.safeParse(await searchParams);
  const days = parsed.success ? parsed.data.days : 30;
  const a = await getRevenueAnalytics(days);
  const t = a.totals;
  const period = `vs previous ${days} days`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label="Time range"
          tabs={[7, 30, 90].map((d) => ({ label: `Last ${d} days`, href: `/admin/revenue?days=${d}`, active: d === days }))}
        />
        <a href={`/api/admin/reports/export?days=${days}`} download className={buttonClasses({ variant: "secondary", size: "sm" })}>
          ⬇ Download all orders (CSV)
        </a>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <StatTile
            hero
            label="Delivered order value"
            value={formatPrice(t.deliveredValue)}
            delta={percentChange(t.deliveredValue, a.previous.deliveredValue)}
            deltaLabel={period}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <StatTile label="Orders placed" value={t.orders.toLocaleString("en")} delta={percentChange(t.orders, a.previous.orders)} deltaLabel={period} />
          <StatTile label="Average delivered order" value={formatPrice(t.avgOrderValue)} />
          <StatTile
            label="Rejected or cancelled"
            value={t.orders ? `${Math.round((t.failed / t.orders) * 100)}%` : "—"}
          />
          <StatTile label="New customers · new shops" value={`${t.newCustomers} · ${t.newShops}`} />
        </div>
      </div>

      <Card className="flex flex-col gap-4">
        <div>
          <CardTitle>Delivered order value per day</CardTitle>
          <CardDescription>
            By order date ({TIME_ZONE}). Hover or focus a day for details.
          </CardDescription>
        </div>
        <DailyBarChart
          label={`Delivered order value per day, last ${days} days`}
          data={a.daily.map((d) => ({ date: d.date, value: d.deliveredValue, orders: d.orders }))}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <CardTitle>Top shops</CardTitle>
          {a.topShops.length === 0 ? (
            <CardDescription>No delivered orders in this period.</CardDescription>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 font-medium">Shop</th>
                  <th className="py-1 text-right font-medium">Delivered</th>
                  <th className="py-1 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {a.topShops.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2">
                      <Link href={`/admin/shops/${s.id}`} className="text-primary hover:underline">
                        {s.name}
                      </Link>
                    </td>
                    <td className="py-2 text-right">{s.delivered}</td>
                    <td className="py-2 text-right">{formatPrice(s.deliveredValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card className="flex flex-col gap-2">
          <CardTitle>Platform revenue</CardTitle>
          <CardDescription>
            Aqua&apos;s own revenue will come from shop subscriptions, which aren&apos;t set up yet. The figures above
            are the value of customer orders paid to shops (cash on delivery), including {formatPrice(t.deliveryFees)}{" "}
            in delivery fees.
          </CardDescription>
        </Card>
      </div>
    </>
  );
}
