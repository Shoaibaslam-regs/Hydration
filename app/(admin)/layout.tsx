import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <DashboardShell
      title="Admin"
      nav={[
        { href: "/admin", label: "Overview" },
        { href: "/admin/shops", label: "Shops" },
        { href: "/admin/orders", label: "Orders" },
        { href: "/admin/users", label: "Users" },
        { href: "/admin/revenue", label: "Revenue" },
        { href: "/admin/subscriptions", label: "Subscriptions" },
        { href: "/admin/ads", label: "Ads" },
        { href: "/admin/support", label: "Support" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
