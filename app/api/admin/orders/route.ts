import { apiHandler, json, parseQuery } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { listAdminOrders } from "@/lib/services/admin/orders";
import { adminOrderListSchema } from "@/lib/validation/admin";

/** GET /api/admin/orders?status=&shopId=&q=<order number prefix>&page=&limit= */
export const GET = apiHandler(async (req) => {
  await requireApiUser(["admin"]);
  return json(await listAdminOrders(parseQuery(req, adminOrderListSchema)));
});
