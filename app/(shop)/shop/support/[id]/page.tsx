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
import { requireRole } from "@/lib/auth/session";
import { getMySupportThread } from "@/lib/services/support";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/support/constants";

export const metadata: Metadata = { title: "Conversation · Contact Aqua" };

export default function SupportThreadPage({ params, searchParams }: PageProps<"/shop/support/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/shop/support" className="text-sm text-muted-foreground hover:text-foreground">
        ← All conversations
      </Link>
      <Suspense fallback={<PageSkeleton />}>
        <ThreadContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ThreadContent({
  params,
  searchParams,
}: {
  params: PageProps<"/shop/support/[id]">["params"];
  searchParams: PageProps<"/shop/support/[id]">["searchParams"];
}) {
  const { id } = await params;
  const user = await requireRole(["shopkeeper"], `/shop/support/${id}`);
  const thread = await getMySupportThread(user.id, id);
  if (!thread) notFound();
  const justSent = (await searchParams).sent === "1";

  return (
    <>
      <AutoRefresh />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{thread.subject}</h1>
          <p className="text-sm text-muted-foreground">{SUPPORT_CATEGORY_LABELS[thread.category]}</p>
        </div>
        <Badge tone={thread.status === "open" ? "info" : "neutral"}>{thread.status === "open" ? "Open" : "Resolved"}</Badge>
      </div>

      {justSent && (
        <p role="status" className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm">
          Message sent. The Aqua team will reply here, and you&apos;ll see a red dot on “Contact Aqua”.
        </p>
      )}

      <Card className="flex flex-col gap-5">
        <Conversation messages={thread.messages} viewer="shopkeeper" />
        <div className="border-t border-border pt-4">
          <SupportReplyForm
            endpoint={`/api/shopkeeper/support/${thread.id}`}
            placeholder={thread.status === "open" ? "Write a reply…" : "Reply to reopen this conversation…"}
            note="Ctrl + Enter to send"
          />
        </div>
      </Card>

      <AdminActions
        endpoint={`/api/shopkeeper/support/${thread.id}`}
        actions={
          thread.status === "open"
            ? [{ label: "Mark as resolved", body: { status: "closed" }, confirm: "Mark this conversation as resolved? You can reply later to reopen it." }]
            : [{ label: "Reopen", body: { status: "open" } }]
        }
      />
      <DeleteButton
        endpoint={`/api/shopkeeper/support/${thread.id}`}
        variant="link"
        label="Delete conversation"
        confirmTitle="Delete this conversation?"
        confirmMessage="It's removed from your list. If the Aqua team replies again, it comes back."
        redirectTo="/shop/support"
      />
    </>
  );
}
