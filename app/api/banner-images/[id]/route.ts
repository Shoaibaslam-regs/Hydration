import { connection } from "next/server";
import { getBannerImage } from "@/lib/services/ads/banners";

/** GET /api/banner-images/:id — public. Images never change (a replaced image gets a new id), so cache for a year. */
export async function GET(_req: Request, ctx: RouteContext<"/api/banner-images/[id]">) {
  await connection();
  const img = await getBannerImage((await ctx.params).id);
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
