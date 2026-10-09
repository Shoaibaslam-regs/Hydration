import { ApiError } from "@/lib/api/errors";
import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { createMyShop, deleteMyShop, getMyShop, updateMyShop } from "@/lib/services/my-shop";
import { shopDeleteSchema, shopInputSchema } from "@/lib/validation/shopkeeper";

/** GET /api/shopkeeper/shop — the signed-in shopkeeper's shop. */
export const GET = apiHandler(async () => {
  const user = await requireApiUser(["shopkeeper"]);
  const shop = await getMyShop(user.id);
  if (!shop) throw ApiError.notFound("Register your shop first");
  return json(shop);
});

/** POST /api/shopkeeper/shop — register a shop (starts pending verification). */
export const POST = apiHandler(async (req) => {
  const user = await requireApiUser(["shopkeeper"]);
  const input = await parseBody(req, shopInputSchema);
  return json(await createMyShop(user.id, input), 201);
});

/** PUT /api/shopkeeper/shop — update the shop profile. */
export const PUT = apiHandler(async (req) => {
  const user = await requireApiUser(["shopkeeper"]);
  const input = await parseBody(req, shopInputSchema);
  return json(await updateMyShop(user.id, input));
});

/** DELETE /api/shopkeeper/shop — { confirmName }: permanently delete the shop (cancels unfinished orders). */
export const DELETE = apiHandler(async (req) => {
  const user = await requireApiUser(["shopkeeper"]);
  const { confirmName } = await parseBody(req, shopDeleteSchema);
  return json(await deleteMyShop(user.id, confirmName));
});
