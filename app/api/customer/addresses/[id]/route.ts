import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { deleteAddress, updateAddress } from "@/lib/services/addresses";
import { addressInputSchema } from "@/lib/validation/customer";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

type Ctx = RouteContext<"/api/customer/addresses/[id]">;

/** PUT /api/customer/addresses/:id */
export const PUT = apiHandler(async (req, ctx: Ctx) => {
  const user = await requireApiUser(["customer"]);
  const id = objectIdSchema.parse((await ctx.params).id);
  return json(await updateAddress(user.id, id, await parseBody(req, addressInputSchema)));
});

/** DELETE /api/customer/addresses/:id */
export const DELETE = apiHandler(async (_req, ctx: Ctx) => {
  const user = await requireApiUser(["customer"]);
  await deleteAddress(user.id, objectIdSchema.parse((await ctx.params).id));
  return json({ ok: true });
});
