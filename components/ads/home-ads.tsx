import Link from "next/link";
import { connection } from "next/server";
import { VerifiedBadge } from "@/components/shops/verified-badge";
import { Container } from "@/components/ui/container";
import { formatDateTime } from "@/lib/catalog";
import { listLatestDeals } from "@/lib/services/ads/deals";
import { listRunningBanners } from "@/lib/services/ads/banners";
import { BannerCarousel } from "./banner-carousel";

/**
 * Promotions and latest deals for the home page. Rendered per request (so a
 * build never needs the database) from cached data that admin/shop changes
 * invalidate. Render inside <Suspense>.
 */
export async function HomeAds() {
  await connection();
  const [banners, deals] = await Promise.all([listRunningBanners(), listLatestDeals(6)]);
  if (banners.length === 0 && deals.length === 0) return null;

  return (
    <Container className="flex flex-col gap-10 pt-12">
      {banners.length > 0 && <BannerCarousel banners={banners} />}
      {deals.length > 0 && (
        <section aria-labelledby="deals-heading" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="deals-heading" className="text-2xl font-semibold">
              Latest deals
            </h2>
            <Link href="/shops?deals=1" className="text-sm font-medium text-primary hover:underline">
              Find deals near you →
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/shops/${d.shop.slug}`}
                  className="flex h-full flex-col gap-2 rounded-xl border border-premium/30 bg-gradient-to-br from-premium-soft to-card p-4 transition-shadow hover:border-premium/60 hover:shadow-md"
                >
                  <span className="w-fit rounded bg-premium px-1.5 py-0.5 text-xs font-semibold text-premium-foreground">Deal</span>
                  <span className="font-semibold">{d.title}</span>
                  {d.description && <span className="line-clamp-2 text-sm text-muted-foreground">{d.description}</span>}
                  <span className="mt-auto flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="font-medium">{d.shop.name}</span>
                    {d.shop.hasVerifiedBadge && <VerifiedBadge compact />}
                    <span className="text-muted-foreground">· {[d.shop.area, d.shop.city].filter(Boolean).join(", ")}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">Until {formatDateTime(d.endsAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}
