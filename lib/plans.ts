// Shopkeeper subscription plans. Shown on /pricing now; Phase 6 billing will
// read the same definitions. Prices are minor currency units per month.
// PLACEHOLDER PRICES AND LIMITS: confirm with the business before launch.

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
    monthlyPrice: 150_000,
    tagline: "For small shops getting online.",
    features: ["Listed in nearby search", "Up to 10 products", "Order management", "Basic sales summary"],
  },
  {
    id: "growth",
    name: "Growth",
    monthlyPrice: 350_000,
    tagline: "For busy shops with regular customers.",
    features: ["Everything in Starter", "Unlimited products", "Inventory tracking", "Sales reports & exports"],
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 700_000,
    tagline: "For multi-van delivery operations.",
    features: ["Everything in Growth", "Priority placement in search", "Advanced analytics", "Priority support"],
  },
];
