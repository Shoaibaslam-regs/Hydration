import Link from "next/link";
import type { MyShop } from "@/lib/services/my-shop";
import { VerifiedBadge } from "@/components/shops/verified-badge";
import { cn } from "@/lib/utils";

const CONTENT: Record<MyShop["status"], { title: string; body: string; tone: string }> = {
  pending: {
    title: "Waiting for approval",
    body: "Our team is reviewing your shop. You can add products now; customers will see your shop once it's approved.",
    tone: "border-warning/40 bg-warning/10",
  },
  verified: {
    title: "Your shop is live",
    body: "Customers nearby can find your shop and order from you.",
    tone: "border-success/40 bg-success/10",
  },
  rejected: {
    title: "Your shop was not approved",
    body: "Update your shop profile to fix the issue below. Saving it sends your shop for review again.",
    tone: "border-danger/40 bg-danger/10",
  },
  suspended: {
    title: "Your shop is suspended",
    body: "Your shop is hidden from customers. Contact support for help.",
    tone: "border-danger/40 bg-danger/10",
  },
};

const CLOSED = {
  title: "Your shop is approved but closed",
  body: "Customers can't find it or place new orders until it reopens. Existing orders are still in your list.",
  tone: "border-warning/40 bg-warning/10",
};

export function ShopStatusBanner({ shop }: { shop: MyShop }) {
  const c = shop.status === "verified" && shop.closure ? CLOSED : CONTENT[shop.status];
  return (
    <div role="status" className={cn("flex flex-col gap-1 rounded-xl border p-4", c.tone)}>
      <p className="font-semibold">{c.title}</p>
      <p className="text-sm text-muted-foreground">{c.body}</p>
      {shop.hasVerifiedBadge && (
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <VerifiedBadge compact /> Your shop has the Aqua verified badge, shown to customers next to its name.
        </p>
      )}
      {shop.statusReason && (shop.status === "rejected" || shop.status === "suspended") && (
        <p className="text-sm">
          <span className="font-medium">Reason:</span> {shop.statusReason}
        </p>
      )}
      {shop.status === "verified" && !shop.closure && (
        <Link href={`/shops/${shop.slug}`} className="text-sm font-medium text-primary hover:underline">
          View your public page →
        </Link>
      )}
      {shop.status === "rejected" && (
        <Link href="/shop/profile" className="text-sm font-medium text-primary hover:underline">
          Edit shop profile →
        </Link>
      )}
    </div>
  );
}
