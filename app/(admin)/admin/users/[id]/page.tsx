import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminActions, type AdminAction } from "@/components/admin/admin-actions";
import { AuditLog } from "@/components/admin/audit-log";
import { ResetLinkButton } from "@/components/admin/reset-link-button";
import { DeleteUser, SuspendUserForm } from "@/components/admin/user-controls";
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
      ? [{ label: "Sign out everywhere", body: { action: "signOutEverywhere" }, confirm: `Sign ${user.name} out of every device?` }]
      : [{ label: "Lift suspension now", body: { action: "activate" } }];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-foreground">
          ← Users
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <Badge tone="info">{user.role}</Badge>
          {user.status === "suspended" && (
            <Badge tone="danger">{user.suspendedUntil ? `Suspended until ${formatDateTime(user.suspendedUntil)}` : "Suspended"}</Badge>
          )}
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
              {user.status === "suspended"
                ? user.suspendedUntil
                  ? `Suspended until ${formatDateTime(user.suspendedUntil)}. The account unlocks automatically then.`
                  : "Suspended until an admin lifts it."
                : "Suspended users are signed out immediately and can't log in until the suspension ends."}
              {user.role === "shopkeeper" && " Their shop stays live unless you close or suspend it separately."}
            </CardDescription>
            <div className="flex flex-wrap items-start gap-2">
              <AdminActions endpoint={`/api/admin/users/${user.id}`} actions={actions} reasonHint="Kept in the admin history." />
              {user.status === "active" && <SuspendUserForm userId={user.id} />}
            </div>
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

      {!isSelf && (
        <Card className="flex flex-col gap-3 border-danger/40">
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>
            Deleting this account can&apos;t be undone.{" "}
            {user.role === "customer" &&
              `Their addresses, reviews and saved shops are deleted, unfinished orders are cancelled, and their ${user.orderCount} past ${user.orderCount === 1 ? "order keeps" : "orders keep"} totals for the shops' records but lose the name, phone and street address.`}
            {user.role === "shopkeeper" &&
              (user.shop
                ? `Their shop "${user.shop.name}" is removed with its products and reviews, and its unfinished orders are cancelled. Plan payment records are kept.`
                : "They haven't registered a shop.")}
            {user.role === "admin" && "They lose admin access immediately."} To stop access for a while instead, suspend the account.
          </CardDescription>
          <DeleteUser userId={user.id} email={user.email} />
        </Card>
      )}
    </div>
  );
}
