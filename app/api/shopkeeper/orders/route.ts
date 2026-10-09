import { apiHandler, json, parseQuery } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { requireMyShop } from "@/lib/services/my-shop";
import { listShopOrders } from "@/lib/services/shop-orders";
import { orderListQuerySchema } from "@/lib/validation/shopkeeper";

/** GET /api/shopkeeper/orders?status=&page=&limit= */
export const GET = apiHandler(async (req) => {
  const user = await requireApiUser(["shopkeeper"]);
  const shop = await requireMyShop(user.id);
  return json(await listShopOrders(shop, parseQuery(req, orderListQuerySchema)));
});
