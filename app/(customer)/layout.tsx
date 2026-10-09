import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function CustomerLayout({ children }: LayoutProps<"/">) {
  return (
    <DashboardShell
      title="My account"
      nav={[
        { href: "/account", label: "Overview" },
        { href: "/account/orders", label: "My orders" },
        { href: "/shops", label: "Find shops" },
        { href: "/account/favorites", label: "Saved shops" },
        { href: "/account/addresses", label: "Addresses" },
        { href: "/account/profile", label: "Profile" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
