import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/catalog";
import type { AuditEntry } from "@/lib/services/admin/audit";

const ACTION_LABELS: Record<string, string> = {
  "shop.verified": "Verified shop",
  "shop.rejected": "Rejected shop",
  "shop.suspended": "Suspended shop",
  "shop.closed": "Closed shop",
  "shop.reopened": "Reopened shop",
  "shop.removed": "Removed shop permanently",
  "user.suspend": "Suspended user",
  "user.activate": "Reactivated user",
  "user.signOutEverywhere": "Signed out all sessions",
  "user.resetLink": "Created password reset link",
  "order.cancel": "Cancelled order",
};

export function AuditLog({ entries }: { entries: AuditEntry[] }) {
  return (
    <Card className="flex flex-col gap-2 text-sm">
      <CardTitle>Admin history</CardTitle>
      {entries.length === 0 ? (
        <CardDescription>No admin actions yet.</CardDescription>
      ) : (
        <ol className="flex flex-col gap-2">
          {entries.map((e) => (
            <li key={e.id}>
              <span className="font-medium">{ACTION_LABELS[e.action] ?? e.action}</span>
              <span className="text-muted-foreground">
                {" "}
                · {e.adminName} · {formatDateTime(e.createdAt)}
              </span>
              {e.reason && <span className="block text-muted-foreground">“{e.reason}”</span>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
