import { apiHandler, json, parseQuery } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { requireMyShop } from "@/lib/services/my-shop";
import { clearShopOrderHistory, listShopOrders } from "@/lib/services/shop-orders";
import { orderListQuerySchema } from "@/lib/validation/shopkeeper";

/** GET /api/shopkeeper/orders?status=&page=&limit= */
export const GET = apiHandler(async (req) => {
  const user = await requireApiUser(["shopkeeper"]);
  const shop = await requireMyShop(user.id);
  return json(await listShopOrders(shop, parseQuery(req, orderListQuerySchema)));
});

/** DELETE /api/shopkeeper/orders — remove every finished order from the list (reports keep them). */
export const DELETE = apiHandler(async () => {
  const user = await requireApiUser(["shopkeeper"]);
  return json({ removed: await clearShopOrderHistory(await requireMyShop(user.id)) });
});
