import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { HomeAds } from "@/components/ads/home-ads";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import heroImage from "@/public/images/home-hero.png";

const steps = [
  { title: "Find nearby shops", body: "Type your area or use your location to see shops nearby, with prices and ratings." },
  { title: "Choose your water", body: "Choose how many 19L cans you need and pay cash on delivery." },
  { title: "Track your order", body: "Follow your order from confirmation to delivery." },
];

export default function Home() {
  return (
    <>
      {/* The photo is dark in both color themes, so the hero text is always white. */}
      <section className="relative isolate overflow-hidden bg-[#06142e] text-white">
        <Image
          src={heroImage}
          alt=""
          fill
          preload
          placeholder="blur"
          sizes="100vw"
          className="-z-10 object-cover object-[75%_center]"
        />
        {/* Shade the left side so the text stays readable where the photo shows through on phones. */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-[#06142e]/95 via-[#06142e]/75 to-[#06142e]/10 md:via-[#06142e]/40 md:to-transparent" />
        <Container className="flex min-h-[28rem] flex-col items-start justify-center gap-6 py-16 sm:min-h-[32rem] sm:py-24 lg:min-h-[36rem]">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight drop-shadow-sm sm:text-5xl">
            Clean drinking water, delivered from shops near you.
          </h1>
          <p className="max-w-xl text-lg text-white/85">
            Aqua connects you with trusted local water shops. Compare prices, book in a few taps, and track
            every delivery.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/shops" className={buttonClasses({ size: "lg" })}>
              Find shops near me
            </Link>
            <Link href="/pricing" className={buttonClasses({ size: "lg", variant: "on-dark" })}>
              List your shop
            </Link>
          </div>
        </Container>
      </section>

      <Suspense fallback={null}>
        <HomeAds />
      </Suspense>

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
