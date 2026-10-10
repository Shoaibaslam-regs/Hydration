// Shopkeeper subscription plans, shown on /pricing and used by billing.
// Prices are minor currency units per month (100_000 = PKR 1,000), set by the
// owner on 2026-10-10. Feature limits (e.g. Starter's 10 products) are listed
// but not enforced yet.

export type PlanId = "starter" | "growth" | "pro";

export type Plan = {
  id: PlanId;
  name: string;
  monthlyPrice: number;
  tagline: string;
  features: string[];
  highlighted?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 100_000,
    tagline: "For small shops getting online.",
    features: ["Listed in nearby search", "Up to 10 products", "Order management", "Basic sales summary"],
  },
  {
    id: "growth",
    name: "Growth",
    monthlyPrice: 250_000,
    tagline: "For busy shops with regular customers.",
    features: ["Everything in Starter", "Unlimited products", "Inventory tracking", "Sales reports & exports"],
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 450_000,
    tagline: "For multi-van delivery operations.",
    features: ["Everything in Growth", "Priority placement in search", "Advanced analytics", "Priority support"],
  },
];
