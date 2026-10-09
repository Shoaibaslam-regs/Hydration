import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/catalog";
import { listAdminShops } from "@/lib/services/admin/shops";
import { getPlatformCounts } from "@/lib/services/admin-stats";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminOverview />
    </Suspense>
  );
}

async function AdminOverview() {
  await requireRole(["admin"], "/admin");
  const [counts, queue] = await Promise.all([
    getPlatformCounts(),
    listAdminShops({ status: "pending", page: 1, limit: 5 }),
  ]);

  const stats = [
    { label: "Shops awaiting verification", value: counts.shops.pending, href: "/admin/shops?status=pending", alert: counts.shops.pending > 0 },
    { label: "Verified shops", value: counts.shops.verified, href: "/admin/shops?status=verified" },
    { label: "Suspended shops", value: counts.shops.suspended, href: "/admin/shops?status=suspended" },
    { label: "Customers", value: counts.users.customer, href: "/admin/users?role=customer" },
    { label: "Shopkeepers", value: counts.users.shopkeeper, href: "/admin/users?role=shopkeeper" },
    { label: "Admins", value: counts.users.admin, href: "/admin/users?role=admin" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Platform overview</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group">
            <Card className={s.alert ? "border-warning" : "group-hover:border-primary"}>
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-3xl font-bold">{s.value.toLocaleString("en")}</p>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Verification queue</CardTitle>
          {queue.total > 0 && (
            <Link href="/admin/shops?status=pending" className="text-sm font-medium text-primary hover:underline">
              View all {queue.total}
            </Link>
          )}
        </div>
        {queue.items.length === 0 ? (
          <CardDescription>No shops are waiting for review.</CardDescription>
        ) : (
          <ul className="divide-y divide-border">
            {queue.items.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/shops/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:text-primary">
                  <span className="flex flex-col">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-sm text-muted-foreground">{[s.area, s.city].filter(Boolean).join(", ")}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">{formatDateTime(s.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
