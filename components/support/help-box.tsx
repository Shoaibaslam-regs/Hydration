import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { SUPPORT_PATH, type SupportUserRole } from "@/lib/support/constants";

const TEXT: Record<SupportUserRole, string> = {
  shopkeeper: "Payments, ads, orders or your listing: message the Aqua team any time.",
  customer: "A problem with an order, a shop or your account? Message the Aqua team any time.",
};

/** "Need help?" box under the dashboard menu, on every customer and shopkeeper page. */
export function SupportHelpBox({ role }: { role: SupportUserRole }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-gradient-to-br from-accent to-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
          💬
        </span>
        Need help?
      </p>
      <p className="text-xs text-muted-foreground">{TEXT[role]}</p>
      <Link href={SUPPORT_PATH[role]} className={buttonClasses({ size: "sm", className: "w-full" })}>
        Contact Aqua
      </Link>
    </div>
  );
}
