import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { requireApiUser } from "@/lib/auth/session";
import { createMyDeal, listMyDeals } from "@/lib/services/ads/deals";
import { requireMyShop } from "@/lib/services/my-shop";
import { dealInputSchema } from "@/lib/validation/ads";

/** GET /api/shopkeeper/deals */
export const GET = apiHandler(async () => {
  const user = await requireApiUser(["shopkeeper"]);
  return json({ items: await listMyDeals(await requireMyShop(user.id)) });
});

/** POST /api/shopkeeper/deals — { title, description?, days } */
export const POST = apiHandler(async (req) => {
  const user = await requireApiUser(["shopkeeper"]);
  await rateLimit(`deals:${user.id}`, 20, 24 * 60 * 60 * 1000);
  const shop = await requireMyShop(user.id);
  return json(await createMyDeal(shop, await parseBody(req, dealInputSchema)), 201);
});
