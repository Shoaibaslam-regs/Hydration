import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { formatPrice } from "@/lib/catalog";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import { cn } from "@/lib/utils";

const plan = PLANS[0];

export const metadata: Metadata = {
  title: "Pricing for shopkeepers",
  description: `List your water shop on Aqua and reach customers nearby. ${TRIAL_DAYS} days free, then ${formatPrice(plan.monthlyPrice)} a month.`,
};

const steps = [
  { title: "Register your shop", body: "Add your shop's location, delivery area and price per can." },
  { title: "Get approved", body: `Our team reviews your shop. Your ${TRIAL_DAYS}-day free trial starts when it's approved.` },
  { title: "Take orders", body: "Customers nearby find your shop and order cans. Keep the plan active to stay listed." },
];

const options = [
  {
    name: "Free trial",
    price: "Free",
    period: `for ${TRIAL_DAYS} days`,
    tagline: "Try Aqua with real customers before you pay.",
    features: ["Starts when your shop is approved", "Everything in the monthly plan", "No payment details needed"],
    highlighted: false,
  },
  {
    name: plan.name,
    price: formatPrice(plan.monthlyPrice),
    period: "/ month",
    tagline: plan.tagline,
    features: plan.features,
    highlighted: true,
  },
];

export default function PricingPage() {
  return (
    <Container className="flex flex-col gap-12 py-12 sm:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">Grow your water business</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Get discovered by customers near your shop and take orders online. {TRIAL_DAYS} days free, then one simple monthly price.
        </p>
      </div>

      <div className="mx-auto grid w-full max-w-3xl gap-6 md:grid-cols-2">
        {options.map((o) => (
          <Card key={o.name} className={cn("flex flex-col gap-5 p-6", o.highlighted && "border-primary ring-2 ring-primary/30")}>
            <div>
              <h2 className="text-lg font-semibold">{o.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{o.tagline}</p>
            </div>
            <p>
              <span className="text-3xl font-bold">{o.price}</span>
              <span className="text-muted-foreground"> {o.period}</span>
            </p>
            <ul className="flex flex-col gap-2 text-sm">
              {o.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span aria-hidden className="text-success">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/register?role=shopkeeper"
              className={buttonClasses({ variant: o.highlighted ? "primary" : "secondary", className: "mt-auto w-full" })}
            >
              {o.highlighted ? "Register your shop" : "Start free trial"}
            </Link>
          </Card>
        ))}
      </div>

      <section aria-labelledby="steps-heading" className="mx-auto w-full max-w-4xl">
        <h2 id="steps-heading" className="text-center text-xl font-semibold">
          How listing works
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-1 rounded-xl border border-border p-5">
              <span className="text-sm font-semibold text-primary">Step {i + 1}</span>
              <span className="font-medium">{step.title}</span>
              <span className="text-sm text-muted-foreground">{step.body}</span>
            </li>
          ))}
        </ol>
      </section>
    </Container>
  );
}
