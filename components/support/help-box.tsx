import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

/** "Need help?" box under the shop dashboard menu, on every shopkeeper page. */
export function SupportHelpBox() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-gradient-to-br from-accent to-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
          💬
        </span>
        Need help?
      </p>
      <p className="text-xs text-muted-foreground">Payments, ads, orders or your listing: message the Aqua team any time.</p>
      <Link href="/shop/support" className={buttonClasses({ size: "sm", className: "w-full" })}>
        Contact Aqua
      </Link>
    </div>
  );
}
