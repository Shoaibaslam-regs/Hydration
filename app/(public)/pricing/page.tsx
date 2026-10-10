import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { formatPrice } from "@/lib/catalog";
import { PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing for shopkeepers",
  description: "List your water shop on Aqua and reach customers nearby. Simple monthly plans.",
};

const steps = [
  { title: "Register your shop", body: "Add your shop details, location, and products." },
  { title: "Get approved", body: "Our team reviews and approves your shop." },
  { title: "Go live", body: "With an active plan, customers nearby can find and order from you." },
];

export default function PricingPage() {
  return (
    <Container className="flex flex-col gap-12 py-12 sm:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">Grow your water business</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Get discovered by customers near your shop, take orders online, and track your sales.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.id}
            className={cn("flex flex-col gap-5 p-6", plan.highlighted && "border-primary ring-2 ring-primary/30")}
          >
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                {plan.highlighted && (
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                    Most popular
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
            </div>
            <p>
              <span className="text-3xl font-bold">{formatPrice(plan.monthlyPrice)}</span>
              <span className="text-muted-foreground"> / month</span>
            </p>
            <ul className="flex flex-col gap-2 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span aria-hidden className="text-success">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={`/register?role=shopkeeper&plan=${plan.id}`}
              className={buttonClasses({
                variant: plan.highlighted ? "primary" : "secondary",
                className: "mt-auto w-full",
              })}
            >
              Register your shop
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
