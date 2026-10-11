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
        <p className="text-muted-foreground">Messages from shopkeepers. Unread conversations come first.</p>
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

  return (
    <>
      <FilterTabs
        label="Conversation status"
        tabs={TABS.map((t) => ({ label: t.label, href: t.status === "open" ? "/admin/support" : `/admin/support?status=${t.status}`, active: status === t.status }))}
      />
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
                      {t.lastMessageBy === "shopkeeper" && t.status === "open" && <Badge tone="warning">Needs reply</Badge>}
                      <Badge tone={t.status === "open" ? "info" : "neutral"}>{t.status === "open" ? "Open" : "Resolved"}</Badge>
                    </span>
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {t.lastMessageBy === "admin" ? "You: " : ""}
                    {t.preview}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t.shopName || "No shop yet"} · {SUPPORT_CATEGORY_LABELS[t.category]} · {t.messageCount} {t.messageCount === 1 ? "message" : "messages"} ·{" "}
                    {formatDateTime(t.lastMessageAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} hrefFor={(p) => `/admin/support?status=${status}&page=${p}`} />
    </>
  );
}
