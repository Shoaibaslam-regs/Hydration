import { ApiError } from "@/lib/api/errors";
import { apiHandler, json } from "@/lib/api/handler";
import { getShopBySlug } from "@/lib/services/shops";
import { shopSlugSchema } from "@/lib/validation/shops";

/** GET /api/shops/:slug — a verified shop with its active products. */
export const GET = apiHandler(async (_req, ctx: RouteContext<"/api/shops/[slug]">) => {
  const slug = shopSlugSchema.parse((await ctx.params).slug);
  const shop = await getShopBySlug(slug);
  if (!shop) throw ApiError.notFound("Shop not found");
  return json(shop);
});
