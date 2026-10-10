// Shopkeeper plans, shown on /pricing and used by billing. Every approved shop
// gets a free trial that starts when an admin approves it; after that it must
// pay the monthly plan to stay listed and keep taking orders.
// Prices are minor currency units (150_000 = PKR 1,500), set by the owner on 2026-10-10.

export const TRIAL_DAYS = 3;
/** `Shop.subscription.planId` while the free trial runs. Not something shops can buy. */
export const TRIAL_PLAN_ID = "trial";

export type PlanId = "monthly";

export type Plan = {
  id: PlanId;
  name: string;
  monthlyPrice: number;
  tagline: string;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: "monthly",
    name: "Monthly",
    monthlyPrice: 150_000,
    tagline: "Everything your shop needs to take orders online.",
    features: ["Listed in nearby search", "Unlimited orders", "Order notifications", "Sales reports & exports", "Free deals on your shop"],
  },
];

/** Display name for a plan id stored on a shop or payment (including the trial and retired plans). */
export function planName(id: string): string {
  if (id === TRIAL_PLAN_ID) return "Free trial";
  return PLANS.find((p) => p.id === id)?.name ?? id.charAt(0).toUpperCase() + id.slice(1);
}
