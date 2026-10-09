import { apiHandler, json, parseQuery } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { listAdminShops } from "@/lib/services/admin/shops";
import { adminShopListSchema } from "@/lib/validation/admin";

/** GET /api/admin/shops?status=&q=&page=&limit= (pending first) */
export const GET = apiHandler(async (req) => {
  await requireApiUser(["admin"]);
  return json(await listAdminShops(parseQuery(req, adminShopListSchema)));
});
