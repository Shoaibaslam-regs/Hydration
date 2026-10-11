import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminActions } from "@/components/admin/admin-actions";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { AutoRefresh } from "@/components/support/auto-refresh";
import { Conversation } from "@/components/support/conversation";
import { SupportReplyForm } from "@/components/support/reply-form";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/ui/delete-button";
import { Card } from "@/components/ui/card";
import { IdChip } from "@/components/ui/id-chip";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/catalog";
import { getSupportThreadForAdmin } from "@/lib/services/support";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/support/constants";

export const metadata: Metadata = { title: "Conversation · Support · Admin" };

export default function AdminSupportThreadPage({ params }: PageProps<"/admin/support/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/support" className="text-sm text-muted-foreground hover:text-foreground">
        ← Support
      </Link>
      <Suspense fallback={<PageSkeleton />}>
        <ThreadContent params={params} />
      </Suspense>
    </div>
  );
}

async function ThreadContent({ params }: { params: PageProps<"/admin/support/[id]">["params"] }) {
  const { id } = await params;
  await requireRole(["admin"], `/admin/support/${id}`);
  const thread = await getSupportThreadForAdmin(id);
  if (!thread) notFound();

  return (
    <>
      <AutoRefresh />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{thread.subject}</h1>
          <p className="text-sm text-muted-foreground">
            {SUPPORT_CATEGORY_LABELS[thread.category]} · started {formatDateTime(thread.createdAt)}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={thread.userRole === "customer" ? "neutral" : "info"}>{thread.userRole === "customer" ? "Customer" : "Shopkeeper"}</Badge>
            <Link href={`/admin/users/${thread.userId}`} className="font-medium text-primary hover:underline">
              {thread.userName}
            </Link>
            <IdChip id={thread.userPublicId} />
            {thread.shopId && (
              <Link href={`/admin/shops/${thread.shopId}`} className="text-primary hover:underline">
                {thread.shopName || "Shop"}
              </Link>
            )}
          </p>
        </div>
        <Badge tone={thread.status === "open" ? "info" : "neutral"}>{thread.status === "open" ? "Open" : "Resolved"}</Badge>
      </div>

      <Card className="flex flex-col gap-5">
        <Conversation messages={thread.messages} viewer="admin" />
        <div className="border-t border-border pt-4">
          <SupportReplyForm
            endpoint={`/api/admin/support/${thread.id}`}
            placeholder="Reply as the Aqua team…"
            note="They see this signed “Aqua team”. Ctrl + Enter to send."
          />
        </div>
      </Card>

      <AdminActions
        endpoint={`/api/admin/support/${thread.id}`}
        actions={
          thread.status === "open"
            ? [{ label: "Mark as resolved", body: { status: "closed" } }]
            : [{ label: "Reopen", body: { status: "open" } }]
        }
      />
      <DeleteButton
        endpoint={`/api/admin/support/${thread.id}`}
        variant="link"
        label="Delete conversation permanently"
        confirmTitle="Delete this conversation permanently?"
        confirmMessage="It's deleted for them too. This can't be undone."
        confirmLabel="Delete permanently"
        redirectTo="/admin/support"
      />
    </>
  );
}
