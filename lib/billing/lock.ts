// When a shop's dashboard is locked for an unpaid plan. Safe for client code.

/**
 * An approved shop whose free trial or paid month has ended is locked: the
 * shopkeeper can only reach Billing, Contact Aqua and their profile until an
 * admin approves a payment. Pending, rejected and suspended shops have their
 * own states and aren't locked by billing.
 */
export function isShopLocked(shop: { status: string; plan: { active: boolean } | null }): boolean {
  return shop.status === "verified" && !shop.plan?.active;
}

export const LOCKED_MESSAGE = "Your plan has ended, so your shop is locked. Pay your monthly fee under Billing to unlock it.";
