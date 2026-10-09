import { ApiError } from "@/lib/api/errors";
import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { adminCancelOrder, getAdminOrder } from "@/lib/services/admin/orders";
import { adminOrderCancelSchema } from "@/lib/validation/admin";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

type Ctx = RouteContext<"/api/admin/orders/[id]">;

/** GET /api/admin/orders/:id */
export const GET = apiHandler(async (_req, ctx: Ctx) => {
  await requireApiUser(["admin"]);
  const order = await getAdminOrder(objectIdSchema.parse((await ctx.params).id));
  if (!order) throw ApiError.notFound("Order not found");
  return json(order);
});

/** PATCH /api/admin/orders/:id — { reason }: cancel an order that isn't final (disputes). */
export const PATCH = apiHandler(async (req, ctx: Ctx) => {
  const admin = await requireApiUser(["admin"]);
  const id = objectIdSchema.parse((await ctx.params).id);
  const { reason } = await parseBody(req, adminOrderCancelSchema);
  await adminCancelOrder(admin, id, reason);
  return json(await getAdminOrder(id));
});
