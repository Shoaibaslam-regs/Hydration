import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { NotificationDot } from "@/components/notifications/count-badge";
import { NewSupportThreadForm } from "@/components/support/new-thread-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/catalog";
import { listMySupportThreads } from "@/lib/services/support";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/support/constants";

export const metadata: Metadata = { title: "Contact Aqua " };

export default function SupportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Contact the Aqua team</h1>
        <p className="text-muted-foreground">Questions about payments, ads, orders or your listing? Send us a message and we&apos;ll reply here.</p>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <SupportContent />
      </Suspense>
    </div>
  );
}

async function SupportContent() {
  const user = await requireRole(["shopkeeper"], "/shop/support");
  const threads = await listMySupportThreads(user.id);

  return (
    <>
      <Card className="flex flex-col gap-4">
        <div>
          <CardTitle>New message</CardTitle>
          <CardDescription>We usually reply within a day. You&apos;ll see a red dot on “Contact Aqua” when we do.</CardDescription>
        </div>
        <NewSupportThreadForm />
      </Card>

      <section aria-labelledby="threads-heading" className="flex flex-col gap-3">
        <h2 id="threads-heading" className="text-lg font-semibold">
          Your conversations
        </h2>
        {threads.length === 0 ? (
          <Card className="text-sm text-muted-foreground">No conversations yet.</Card>
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-border">
              {threads.map((t) => (
                <li key={t.id}>
                  <Link href={`/shop/support/${t.id}`} className="flex flex-col gap-1 px-5 py-4 hover:bg-muted/50">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 font-medium">
                        <span className="truncate">{t.subject}</span>
                        {t.unread && <NotificationDot label="New reply" />}
                      </span>
                      <Badge tone={t.status === "open" ? "info" : "neutral"}>{t.status === "open" ? "Open" : "Resolved"}</Badge>
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {t.lastMessageBy === "admin" ? "Aqua team: " : "You: "}
                      {t.preview}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {SUPPORT_CATEGORY_LABELS[t.category]} · {formatDateTime(t.lastMessageAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </>
  );
}
