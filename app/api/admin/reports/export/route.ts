import { apiHandler, parseQuery } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { csvResponse, exportOrdersCsv } from "@/lib/services/reports";
import { analyticsRangeSchema } from "@/lib/validation/admin";

/** GET /api/admin/reports/export?days= — CSV of all orders on the platform. */
export const GET = apiHandler(async (req) => {
  await requireApiUser(["admin"]);
  const { days } = parseQuery(req, analyticsRangeSchema);
  const { csv, truncated } = await exportOrdersCsv(days);
  return csvResponse(csv, `aqua-orders-last-${days}-days.csv`, truncated);
});
