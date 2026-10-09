import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { SHOP_STATUS_LABELS, SHOP_STATUS_TONES, type ShopStatus } from "@/lib/admin/shop-status";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/catalog";
import { listAdminShops } from "@/lib/services/admin/shops";
import { adminShopListSchema } from "@/lib/validation/admin";

export const metadata: Metadata = { title: "Shops · Admin" };

const STATUSES: ShopStatus[] = ["pending", "verified", "rejected", "suspended"];

export default function AdminShopsPage({ searchParams }: PageProps<"/admin/shops">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Shops</h1>
      <Suspense fallback={<PageSkeleton />}>
        <ShopsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ShopsContent({ searchParams }: { searchParams: PageProps<"/admin/shops">["searchParams"] }) {
  await requireRole(["admin"], "/admin/shops");
  const parsed = adminShopListSchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : adminShopListSchema.parse({});
  const result = await listAdminShops(query);

  const href = (over: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    const merged = { status: query.status, q: query.q, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
    const s = qs.toString();
    return s ? `/admin/shops?${s}` : "/admin/shops";
  };

  return (
    <>
      <FilterTabs
        label="Filter by status"
        tabs={[
          { label: "All", href: href({ status: undefined, page: undefined }), active: !query.status },
          ...STATUSES.map((s) => ({ label: SHOP_STATUS_LABELS[s], href: href({ status: s }), active: query.status === s })),
        ]}
      />
      <form action="/admin/shops" className="flex gap-2">
        {query.status && <input type="hidden" name="status" value={query.status} />}
        <Input name="q" type="search" placeholder="Search name, city, area, phone" defaultValue={query.q ?? ""} aria-label="Search shops" />
        <button type="submit" className={buttonClasses({ variant: "secondary" })}>
          Search
        </button>
      </form>

      {result.items.length === 0 ? (
        <EmptyState title="No shops found" description={query.status === "pending" ? "Nothing is waiting for review." : undefined} />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {result.items.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/shops/${s.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-muted/50">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{s.name}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {[s.area, s.city].filter(Boolean).join(", ")} · {s.owner ? `${s.owner.name} (${s.owner.email})` : "No owner"}
                    </span>
                    <span className="text-xs text-muted-foreground">Registered {formatDateTime(s.createdAt)}</span>
                  </span>
                  <Badge tone={SHOP_STATUS_TONES[s.status]}>{SHOP_STATUS_LABELS[s.status]}</Badge>
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
