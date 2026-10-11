import Link from "next/link";
import type { MyShop } from "@/lib/services/my-shop";
import { StarShopBadge } from "@/components/shops/star-badge";
import { VerifiedBadge } from "@/components/shops/verified-badge";
import { formatDateTime } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const CONTENT: Record<MyShop["status"], { title: string; body: string; tone: string }> = {
  pending: {
    title: "Waiting for approval",
    body: "Our team is reviewing your shop. Once it's approved, customers can find it and your free trial starts.",
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

const NO_PRICE = {
  title: "Your shop is approved but hidden",
  body: "Set your price per can in your shop profile so customers can find you and order.",
  tone: "border-warning/40 bg-warning/10",
};

const PLAN_ENDED = {
  title: "Your shop is hidden: your plan has ended",
  body: "Customers can't find your shop or order until you pay for the monthly plan. Existing orders are still in your list.",
  tone: "border-danger/40 bg-danger/10",
};

export function ShopStatusBanner({ shop }: { shop: MyShop }) {
  const approvedOpen = shop.status === "verified" && !shop.closure;
  const noPrice = approvedOpen && !shop.pricePerCan;
  const planEnded = approvedOpen && !noPrice && !shop.plan?.active;
  const hidden = noPrice || planEnded;
  const c =
    shop.status === "verified" && shop.closure ? CLOSED : noPrice ? NO_PRICE : planEnded ? PLAN_ENDED : CONTENT[shop.status];
  return (
    <div role="status" className={cn("flex flex-col gap-1 rounded-xl border p-4", c.tone)}>
      <p className="font-semibold">{c.title}</p>
      <p className="text-sm text-muted-foreground">{c.body}</p>
      {shop.hasVerifiedBadge && (
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <VerifiedBadge compact /> Your shop has the Aqua verified badge, shown to customers next to its name.
        </p>
      )}
      {shop.hasStarAward && (
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <StarShopBadge compact /> The Aqua team named you a Star shop. Customers see the mark on your shop.
        </p>
      )}
      {shop.statusReason && (shop.status === "rejected" || shop.status === "suspended") && (
        <p className="text-sm">
          <span className="font-medium">Reason:</span> {shop.statusReason}
        </p>
      )}
      {noPrice && (
        <Link href="/shop/profile" className="text-sm font-medium text-primary hover:underline">
          Set your price →
        </Link>
      )}
      {planEnded && (
        <Link href="/shop/billing" className="text-sm font-medium text-primary hover:underline">
          Pay for your plan →
        </Link>
      )}
      {approvedOpen && !hidden && shop.plan?.isTrial && (
        <p className="text-sm">Free trial until {formatDateTime(shop.plan.endsAt)}.</p>
      )}
      {shop.status === "verified" && !shop.closure && !hidden && (
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
