import { apiHandler, json, parseQuery } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { getRevenueAnalytics } from "@/lib/services/analytics";
import { analyticsRangeSchema } from "@/lib/validation/admin";

/** GET /api/admin/analytics?days=7|30|90 */
export const GET = apiHandler(async (req) => {
  await requireApiUser(["admin"]);
  const { days } = parseQuery(req, analyticsRangeSchema);
  return json(await getRevenueAnalytics(days));
});
