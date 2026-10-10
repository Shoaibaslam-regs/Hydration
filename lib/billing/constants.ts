// Subscription billing constants shared by server and client code.
// Billing is manual for now: shopkeepers pay outside the site and submit a
// reference; an admin approves it. Kept entirely separate from order payments.

export const BILLING_MONTH_OPTIONS = [1, 3, 6, 12] as const;
export type BillingMonths = (typeof BILLING_MONTH_OPTIONS)[number];

export const PAYMENT_METHODS = ["bank_transfer", "jazzcash", "easypaisa", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  other: "Other",
};

export const SUBSCRIPTION_PAYMENT_STATUSES = ["pending", "approved", "rejected"] as const;
export type SubscriptionPaymentStatus = (typeof SUBSCRIPTION_PAYMENT_STATUSES)[number];

/** Add calendar months in UTC (Jan 31 + 1 month → Feb 28/29, never March). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/**
 * When a newly approved payment's period starts: right away if the shop has no
 * plan or it already expired, otherwise when the current plan ends (renewals stack).
 */
export function nextPeriodStart(currentEndsAt: Date | null | undefined, now: Date): Date {
  return currentEndsAt && currentEndsAt > now ? currentEndsAt : now;
}
