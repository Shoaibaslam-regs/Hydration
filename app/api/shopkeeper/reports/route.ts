import { apiHandler, json, parseQuery } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { getSalesAnalytics } from "@/lib/services/analytics";
import { requireMyShop } from "@/lib/services/my-shop";
import { analyticsRangeSchema } from "@/lib/validation/admin";

/** GET /api/shopkeeper/reports?days=7|30|90 — the signed-in shopkeeper's sales. */
export const GET = apiHandler(async (req) => {
  const user = await requireApiUser(["shopkeeper"]);
  const shop = await requireMyShop(user.id);
  const { days } = parseQuery(req, analyticsRangeSchema);
  return json(await getSalesAnalytics(days, shop.id));
});
