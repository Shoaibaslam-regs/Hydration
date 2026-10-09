import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Input, Select } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { USER_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/catalog";
import { listAdminUsers } from "@/lib/services/admin/users";
import { adminUserListSchema } from "@/lib/validation/admin";

export const metadata: Metadata = { title: "Users · Admin" };

const ROLE_LABELS = { customer: "Customers", shopkeeper: "Shopkeepers", admin: "Admins" } as const;

export default function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Users</h1>
      <Suspense fallback={<PageSkeleton />}>
        <UsersContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function UsersContent({ searchParams }: { searchParams: PageProps<"/admin/users">["searchParams"] }) {
  await requireRole(["admin"], "/admin/users");
  const parsed = adminUserListSchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : adminUserListSchema.parse({});
  const result = await listAdminUsers(query);

  const href = (over: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    const merged = { role: query.role, status: query.status, q: query.q, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
    const s = qs.toString();
    return s ? `/admin/users?${s}` : "/admin/users";
  };

  return (
    <>
      <FilterTabs
        label="Filter by role"
        tabs={[
          { label: "All", href: href({ role: undefined }), active: !query.role },
          ...USER_ROLES.map((r) => ({ label: ROLE_LABELS[r], href: href({ role: r }), active: query.role === r })),
        ]}
      />
      <form action="/admin/users" className="flex flex-col gap-2 sm:flex-row">
        {query.role && <input type="hidden" name="role" value={query.role} />}
        <Input name="q" type="search" placeholder="Search name, email, phone" defaultValue={query.q ?? ""} aria-label="Search users" />
        <Select name="status" defaultValue={query.status ?? ""} aria-label="Account status" className="sm:w-44">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </Select>
        <button type="submit" className={buttonClasses({ variant: "secondary" })}>
          Search
        </button>
      </form>

      {result.items.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {result.items.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-muted/50">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{u.name}</span>
                    <span className="truncate text-sm text-muted-foreground">{u.email}</span>
                    <span className="text-xs text-muted-foreground">
                      Joined {formatDateTime(u.createdAt)}
                      {u.lastLoginAt && ` · last login ${formatDateTime(u.lastLoginAt)}`}
                    </span>
                  </span>
                  <span className="flex gap-1.5">
                    <Badge tone="info">{u.role}</Badge>
                    {u.status === "suspended" && <Badge tone="danger">Suspended</Badge>}
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
