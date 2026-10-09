import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { cancelCustomerOrder } from "@/lib/services/customer-orders";
import { customerCancelSchema } from "@/lib/validation/customer";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

/** POST /api/customer/orders/:id/cancel — only while pending. */
export const POST = apiHandler(async (req, ctx: RouteContext<"/api/customer/orders/[id]/cancel">) => {
  const user = await requireApiUser(["customer"]);
  const id = objectIdSchema.parse((await ctx.params).id);
  const { note } = await parseBody(req, customerCancelSchema);
  await cancelCustomerOrder(user.id, id, note);
  return json({ ok: true });
});
