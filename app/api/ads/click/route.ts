import { NextResponse, type NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Shop } from "@/lib/db/models";
import { bannerClickTarget } from "@/lib/services/ads/banners";
import { recordAdEvent } from "@/lib/services/ads/stats";

/**
 * GET /api/ads/click?kind=sponsored|banner&id=… — count a click, then redirect.
 * The destination always comes from the database (shop page or the banner's
 * saved link), never from the URL, so this can't be used as an open redirect.
 */
export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind");
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const home = new URL("/", req.nextUrl);
  if (!Types.ObjectId.isValid(id)) return NextResponse.redirect(home, 303);

  let target: string | null = null;
  if (kind === "sponsored") {
    await connectDB();
    const shop = await Shop.findById(id, { slug: 1 }).lean();
    target = shop ? `/shops/${shop.slug}` : null;
  } else if (kind === "banner") {
    target = await bannerClickTarget(id);
  }
  if (!target) return NextResponse.redirect(home, 303);

  await recordAdEvent(kind as "sponsored" | "banner", id, "click").catch(() => {}); // never block the visitor
  return NextResponse.redirect(new URL(target, req.nextUrl), 303);
}
