import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { formatDateTime } from "@/lib/catalog";
import type { AuditEntry } from "@/lib/services/admin/audit";

const ACTION_LABELS: Record<string, string> = {
  "shop.verified": "Approved shop",
  "shop.rejected": "Rejected shop",
  "shop.suspended": "Suspended shop",
  "shop.closed": "Closed shop",
  "shop.reopened": "Reopened shop",
  "shop.removed": "Removed shop permanently",
  "shop.badge.granted": "Gave verified badge",
  "shop.badge.revoked": "Removed verified badge",
  "user.suspend": "Suspended user",
  "user.activate": "Reactivated user",
  "user.signOutEverywhere": "Signed out all sessions",
  "user.deleted": "Deleted account",
  "user.resetLink": "Created password reset link",
  "subscription.approved": "Approved plan payment",
  "subscription.rejected": "Rejected plan payment",
  "settings.requireSubscription.on": "Turned on: require an active plan",
  "settings.requireSubscription.off": "Turned off: require an active plan",
  "settings.bankAccount": "Updated bank account for payments",
  "settings.paymentInstructions": "Updated payment instructions",
  "settings.sponsorshipInfo": "Updated sponsorship info",
  "ads.campaign.approved": "Approved sponsored campaign",
  "ads.campaign.rejected": "Rejected sponsored campaign",
  "ads.campaign.cancelled": "Cancelled sponsored campaign",
  "ads.deal.removed": "Removed a deal",
  "ads.banner.created": "Created banner",
  "ads.banner.updated": "Updated banner",
  "ads.banner.deleted": "Deleted banner",
  "order.cancel": "Cancelled order",
  "order.deleted": "Deleted order",
  "history.cleared": "Cleared admin history",
  "review.deleted": "Deleted review",
  "ads.campaign.deleted": "Deleted sponsorship record",
  "ads.deal.deleted": "Deleted deal",
  "subscription.deleted": "Deleted rejected payment",
  "support.deleted": "Deleted support conversation",
};

/**
 * "Admin history" for one shop, user, order, or the platform. Admins can
 * delete single entries or clear the whole list (which leaves one
 * "Cleared admin history" entry behind).
 */
export function AuditLog({
  entries,
  target,
}: {
  entries: AuditEntry[];
  target: { type: "shop" | "user" | "order" | "platform"; id: string | null };
}) {
  return (
    <Card className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Admin history</CardTitle>
        {entries.length > 0 && (
          <DeleteButton
            endpoint="/api/admin/history"
            body={{ targetType: target.type, targetId: target.id }}
            variant="link"
            label="Clear history"
            confirmTitle="Clear this admin history?"
            confirmMessage={`${entries.length < 20 ? `${entries.length === 1 ? "The 1 entry" : `All ${entries.length} entries`}` : "Every entry"} here will be deleted. One “Cleared admin history” entry stays, so it's clear it was cleared.`}
            confirmLabel="Clear history"
          />
        )}
      </div>
      {entries.length === 0 ? (
        <CardDescription>No admin actions yet.</CardDescription>
      ) : (
        <ol className="flex flex-col divide-y divide-border">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-2 py-2">
              <span className="min-w-0">
                <span className="font-medium">{ACTION_LABELS[e.action] ?? e.action}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {e.adminName} · {formatDateTime(e.createdAt)}
                </span>
                {e.reason && <span className="block break-words text-muted-foreground">“{e.reason}”</span>}
              </span>
              <DeleteButton
                endpoint={`/api/admin/history/${e.id}`}
                variant="icon"
                label="Delete this entry"
                confirmTitle="Delete this history entry?"
                confirmMessage={`“${ACTION_LABELS[e.action] ?? e.action}” by ${e.adminName} will be removed from the history.`}
              />
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
