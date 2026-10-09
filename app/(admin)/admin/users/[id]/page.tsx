import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminActions, type AdminAction } from "@/components/admin/admin-actions";
import { AuditLog } from "@/components/admin/audit-log";
import { ResetLinkButton } from "@/components/admin/reset-link-button";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { SHOP_STATUS_LABELS, SHOP_STATUS_TONES } from "@/lib/admin/shop-status";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/catalog";
import { getAdminUser } from "@/lib/services/admin/users";

export const metadata: Metadata = { title: "User · Admin" };

export default function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <UserDetail params={params} />
    </Suspense>
  );
}

async function UserDetail({ params }: { params: PageProps<"/admin/users/[id]">["params"] }) {
  const { id } = await params;
  const admin = await requireRole(["admin"], `/admin/users/${id}`);
  const user = await getAdminUser(id);
  if (!user) notFound();
  const isSelf = user.id === admin.id;

  const actions: AdminAction[] =
    user.status === "active"
      ? [
          { label: "Sign out everywhere", body: { action: "signOutEverywhere" }, confirm: `Sign ${user.name} out of every device?` },
          { label: "Suspend account", body: { action: "suspend" }, needsReason: true, danger: true },
        ]
      : [{ label: "Reactivate account", body: { action: "activate" } }];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-foreground">
          ← Users
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <Badge tone="info">{user.role}</Badge>
          {user.status === "suspended" && <Badge tone="danger">Suspended</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {user.email}
          {user.phone && ` · ${user.phone}`} · joined {formatDateTime(user.createdAt)}
          {user.lastLoginAt && ` · last login ${formatDateTime(user.lastLoginAt)}`}
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <CardTitle>Account</CardTitle>
        {isSelf ? (
          <CardDescription>This is your account. Another admin has to change it.</CardDescription>
        ) : (
          <>
            <CardDescription>
              Suspended users are signed out immediately and can&apos;t log in.
              {user.role === "shopkeeper" && " Their shop stays live unless you suspend it separately."}
            </CardDescription>
            <AdminActions endpoint={`/api/admin/users/${user.id}`} actions={actions} reasonHint="Kept in the admin history." />
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-sm font-medium">Forgotten password</p>
              <ResetLinkButton userId={user.id} />
            </div>
          </>
        )}
      </Card>

      {user.role === "customer" && (
        <Card className="text-sm">
          {user.orderCount} {user.orderCount === 1 ? "order" : "orders"} placed.
        </Card>
      )}
      {user.role === "shopkeeper" && (
        <Card className="flex flex-wrap items-center justify-between gap-2 text-sm">
          {user.shop ? (
            <>
              <Link href={`/admin/shops/${user.shop.id}`} className="font-medium text-primary hover:underline">
                {user.shop.name}
              </Link>
              <Badge tone={SHOP_STATUS_TONES[user.shop.status]}>{SHOP_STATUS_LABELS[user.shop.status]}</Badge>
            </>
          ) : (
            <span className="text-muted-foreground">Hasn&apos;t registered a shop yet.</span>
          )}
        </Card>
      )}

      <AuditLog entries={user.history} />
    </div>
  );
}
