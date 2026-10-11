import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { NotificationDot } from "@/components/notifications/count-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Pagination } from "@/components/ui/pagination";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/catalog";
import { listSupportThreadsForAdmin } from "@/lib/services/support";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/support/constants";
import { adminSupportListSchema } from "@/lib/validation/support";

export const metadata: Metadata = { title: "Support · Admin" };

const TABS = [
  { status: "open", label: "Open" },
  { status: "closed", label: "Resolved" },
  { status: "all", label: "All" },
] as const;

export default function AdminSupportPage({ searchParams }: PageProps<"/admin/support">) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Support</h1>
        <p className="text-muted-foreground">Messages from customers and shopkeepers. Unread conversations come first.</p>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <SupportInbox searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SupportInbox({ searchParams }: { searchParams: PageProps<"/admin/support">["searchParams"] }) {
  await requireRole(["admin"], "/admin/support");
  const parsed = adminSupportListSchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : adminSupportListSchema.parse({});
  const status = query.status ?? "open";
  const result = await listSupportThreadsForAdmin({ ...query, status });
  const href = (over: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: status === "open" ? undefined : status, role: query.role, ...over })) if (v) qs.set(k, v);
    const q = qs.toString();
    return q ? `/admin/support?${q}` : "/admin/support";
  };

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs
          label="Conversation status"
          tabs={TABS.map((t) => ({ label: t.label, href: href({ status: t.status === "open" ? undefined : t.status }), active: status === t.status }))}
        />
        <FilterTabs
          label="Who wrote in"
          tabs={[
            { label: "Everyone", href: href({ role: undefined }), active: !query.role },
            { label: "Customers", href: href({ role: "customer" }), active: query.role === "customer" },
            { label: "Shopkeepers", href: href({ role: "shopkeeper" }), active: query.role === "shopkeeper" },
          ]}
        />
      </div>
      {result.items.length === 0 ? (
        <EmptyState title={status === "open" ? "No open conversations" : "Nothing here yet"} />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {result.items.map((t) => (
              <li key={t.id}>
                <Link href={`/admin/support/${t.id}`} className="flex flex-col gap-1 px-5 py-4 hover:bg-muted/50">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`flex min-w-0 items-center gap-2 ${t.unread ? "font-semibold" : "font-medium"}`}>
                      {t.unread && <NotificationDot label="Unread" />}
                      <span className="truncate">{t.subject}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={t.userRole === "customer" ? "neutral" : "info"}>{t.userRole === "customer" ? "Customer" : "Shopkeeper"}</Badge>
                      {t.lastMessageBy !== "admin" && t.status === "open" && <Badge tone="warning">Needs reply</Badge>}
                      <Badge tone={t.status === "open" ? "info" : "neutral"}>{t.status === "open" ? "Open" : "Resolved"}</Badge>
                    </span>
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {t.lastMessageBy === "admin" ? "You: " : ""}
                    {t.preview}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t.userName}
                    {t.userPublicId && ` · ${t.userRole === "customer" ? "Customer" : "Shopkeeper"} ID ${t.userPublicId}`}
                    {t.userRole === "shopkeeper" && ` · ${t.shopName || "no shop yet"}`} · {SUPPORT_CATEGORY_LABELS[t.category]} · {t.messageCount} {t.messageCount === 1 ? "message" : "messages"} ·{" "}
                    {formatDateTime(t.lastMessageAt)}
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
