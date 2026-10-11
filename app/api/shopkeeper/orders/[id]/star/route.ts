import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { requireMyShop } from "@/lib/services/my-shop";
import { setStarCustomer } from "@/lib/services/star-customers";
import { objectIdSchema, starCustomerSchema } from "@/lib/validation/shopkeeper";

/** PUT /api/shopkeeper/orders/:id/star — { star }: tag (or untag) this order's customer as a Star customer. */
export const PUT = apiHandler(async (req, ctx: RouteContext<"/api/shopkeeper/orders/[id]/star">) => {
  const user = await requireApiUser(["shopkeeper"]);
  const id = objectIdSchema.parse((await ctx.params).id);
  const shop = await requireMyShop(user.id);
  const { star } = await parseBody(req, starCustomerSchema);
  await setStarCustomer(shop, id, star);
  return json({ star });
});
