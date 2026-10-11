import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SupportHelpBox } from "@/components/support/help-box";

export default function ShopkeeperLayout({ children }: LayoutProps<"/">) {
  return (
    <DashboardShell
      title="Shop dashboard"
      nav={[
        { href: "/shop", label: "Overview" },
        { href: "/shop/orders", label: "Orders" },
        { href: "/shop/reports", label: "Sales & reports" },
        { href: "/shop/promote", label: "Promote" },
        { href: "/shop/billing", label: "Billing" },
        { href: "/shop/profile", label: "Shop profile" },
        { href: "/shop/support", label: "Contact Aqua", highlight: true },
      ]}
      navFooter={<SupportHelpBox role="shopkeeper" />}
    >
      {children}
    </DashboardShell>
  );
}
