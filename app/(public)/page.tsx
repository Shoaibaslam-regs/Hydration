import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

const steps = [
  { title: "Find nearby shops", body: "See verified water shops around your location, with prices and ratings." },
  { title: "Choose your water", body: "Pick bottles, cans, or refills and the quantity you need." },
  { title: "Track your order", body: "Follow your order from confirmation to delivery." },
];

export default function Home() {
  return (
    <>
      <section className="bg-gradient-to-b from-accent/60 to-background">
        <Container className="flex flex-col items-start gap-6 py-16 sm:py-24">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Clean drinking water, delivered from shops near you.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Aqua connects you with verified local water shops. Compare prices, book in a few taps, and track
            every delivery.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/shops" className={buttonClasses({ size: "lg" })}>
              Find shops near me
            </Link>
            <Link href="/pricing" className={buttonClasses({ size: "lg", variant: "secondary" })}>
              List your shop
            </Link>
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-16">
          <h2 className="text-2xl font-semibold">How it works</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((step, i) => (
              <Card key={step.title}>
                <p className="text-sm font-semibold text-primary">Step {i + 1}</p>
                <CardTitle className="mt-1">{step.title}</CardTitle>
                <CardDescription className="mt-2">{step.body}</CardDescription>
              </Card>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
