import { ApiError } from "@/lib/api/errors";
import { apiHandler, json } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { getCustomerOrder } from "@/lib/services/customer-orders";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

/** GET /api/customer/orders/:id */
export const GET = apiHandler(async (_req, ctx: RouteContext<"/api/customer/orders/[id]">) => {
  const user = await requireApiUser(["customer"]);
  const order = await getCustomerOrder(user.id, objectIdSchema.parse((await ctx.params).id));
  if (!order) throw ApiError.notFound("Order not found");
  return json(order);
});
