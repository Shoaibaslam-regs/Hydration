import { ApiError } from "@/lib/api/errors";
import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { requireMyShop } from "@/lib/services/my-shop";
import { getShopOrder, hideShopOrder, updateShopOrderStatus } from "@/lib/services/shop-orders";
import { objectIdSchema, orderStatusUpdateSchema } from "@/lib/validation/shopkeeper";

type Ctx = RouteContext<"/api/shopkeeper/orders/[id]">;

async function context(ctx: Ctx) {
  const user = await requireApiUser(["shopkeeper"]);
  const id = objectIdSchema.parse((await ctx.params).id);
  return { shop: await requireMyShop(user.id), id };
}

/** GET /api/shopkeeper/orders/:id */
export const GET = apiHandler(async (_req, ctx: Ctx) => {
  const { shop, id } = await context(ctx);
  const order = await getShopOrder(shop, id);
  if (!order) throw ApiError.notFound("Order not found");
  return json(order);
});

/** PATCH /api/shopkeeper/orders/:id — { status, note? } */
export const PATCH = apiHandler(async (req, ctx: Ctx) => {
  const { shop, id } = await context(ctx);
  return json(await updateShopOrderStatus(shop, id, await parseBody(req, orderStatusUpdateSchema)));
});

/** DELETE /api/shopkeeper/orders/:id — remove a finished order from the list (reports keep it). */
export const DELETE = apiHandler(async (_req, ctx: Ctx) => {
  const { shop, id } = await context(ctx);
  await hideShopOrder(shop, id);
  return json({ ok: true });
});
