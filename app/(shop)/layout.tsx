import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function ShopkeeperLayout({ children }: LayoutProps<"/">) {
  return (
    <DashboardShell
      title="Shop dashboard"
      nav={[
        { href: "/shop", label: "Overview" },
        { href: "/shop/orders", label: "Orders" },
        { href: "/shop/products", label: "Products" },
        { href: "/shop/reports", label: "Sales & reports" },
        { href: "/shop/profile", label: "Shop profile" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
