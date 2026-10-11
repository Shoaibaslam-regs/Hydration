import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminActions } from "@/components/admin/admin-actions";
import { NotificationDot } from "@/components/notifications/count-badge";
import { AutoRefresh } from "@/components/support/auto-refresh";
import { Conversation } from "@/components/support/conversation";
import { NewSupportThreadForm } from "@/components/support/new-thread-form";
import { SupportReplyForm } from "@/components/support/reply-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { IdChip } from "@/components/ui/id-chip";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/catalog";
import { getMySupportThread, listMySupportThreads } from "@/lib/services/support";
import { SUPPORT_CATEGORY_LABELS, SUPPORT_PATH, type SupportUserRole } from "@/lib/support/constants";

/** "Contact Aqua" for customers and shopkeepers: a new-message form and their conversations. Render inside <Suspense>. */
export async function SupportInbox({ role }: { role: SupportUserRole }) {
  const base = SUPPORT_PATH[role];
  const user = await requireRole([role], base);
  const threads = await listMySupportThreads(user.id);

  return (
    <>
      <Card className="flex flex-col gap-4">
        <div>
          <CardTitle>New message</CardTitle>
          <CardDescription>We usually reply within a day. You&apos;ll see a red dot on “Contact Aqua” when we do.</CardDescription>
          {user.publicId && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <IdChip id={user.publicId} label={role === "customer" ? "Your Customer ID" : "Your Shopkeeper ID"} />
              <span className="text-xs text-muted-foreground">If you call or WhatsApp the Aqua team, mention this ID.</span>
            </p>
          )}
        </div>
        <NewSupportThreadForm role={role} />
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
                  <Link href={`${base}/${t.id}`} className="flex flex-col gap-1 px-5 py-4 hover:bg-muted/50">
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

/** One of the user's conversations, with reply, resolve and delete. Render inside <Suspense>. */
export async function SupportThreadView({ role, id, justSent }: { role: SupportUserRole; id: string; justSent: boolean }) {
  const base = SUPPORT_PATH[role];
  const user = await requireRole([role], `${base}/${id}`);
  const thread = await getMySupportThread(user.id, id);
  if (!thread) notFound();

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
        <Conversation messages={thread.messages} viewer="user" />
        <div className="border-t border-border pt-4">
          <SupportReplyForm
            endpoint={`/api/support/${thread.id}`}
            placeholder={thread.status === "open" ? "Write a reply…" : "Reply to reopen this conversation…"}
            note="Ctrl + Enter to send"
          />
        </div>
      </Card>

      <AdminActions
        endpoint={`/api/support/${thread.id}`}
        actions={
          thread.status === "open"
            ? [{ label: "Mark as resolved", body: { status: "closed" }, confirm: "Mark this conversation as resolved? You can reply later to reopen it." }]
            : [{ label: "Reopen", body: { status: "open" } }]
        }
      />
      <DeleteButton
        endpoint={`/api/support/${thread.id}`}
        variant="link"
        label="Delete conversation"
        confirmTitle="Delete this conversation?"
        confirmMessage="It's removed from your list. If the Aqua team replies again, it comes back."
        redirectTo={base}
      />
    </>
  );
}
