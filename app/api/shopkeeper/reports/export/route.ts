import { apiHandler, parseQuery } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { requireMyShop } from "@/lib/services/my-shop";
import { csvResponse, exportOrdersCsv } from "@/lib/services/reports";
import { analyticsRangeSchema } from "@/lib/validation/admin";

/** GET /api/shopkeeper/reports/export?days= — CSV of this shop's orders. */
export const GET = apiHandler(async (req) => {
  const user = await requireApiUser(["shopkeeper"]);
  const shop = await requireMyShop(user.id);
  const { days } = parseQuery(req, analyticsRangeSchema);
  const { csv, truncated } = await exportOrdersCsv(days, shop.id);
  return csvResponse(csv, `${shop.slug}-orders-last-${days}-days.csv`, truncated);
});
