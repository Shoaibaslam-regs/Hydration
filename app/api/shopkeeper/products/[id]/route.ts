import { ApiError } from "@/lib/api/errors";
import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { deleteMyProduct, getMyProduct, updateMyProduct } from "@/lib/services/my-products";
import { requireMyShop } from "@/lib/services/my-shop";
import { objectIdSchema, productUpdateSchema } from "@/lib/validation/shopkeeper";

type Ctx = RouteContext<"/api/shopkeeper/products/[id]">;

async function context(ctx: Ctx) {
  const user = await requireApiUser(["shopkeeper"]);
  const id = objectIdSchema.parse((await ctx.params).id);
  return { shop: await requireMyShop(user.id), id };
}

/** GET /api/shopkeeper/products/:id */
export const GET = apiHandler(async (_req, ctx: Ctx) => {
  const { shop, id } = await context(ctx);
  const product = await getMyProduct(shop, id);
  if (!product) throw ApiError.notFound("Product not found");
  return json(product);
});

/** PATCH /api/shopkeeper/products/:id — partial update (price, stock, isActive, …). */
export const PATCH = apiHandler(async (req, ctx: Ctx) => {
  const { shop, id } = await context(ctx);
  return json(await updateMyProduct(shop, id, await parseBody(req, productUpdateSchema)));
});

/** DELETE /api/shopkeeper/products/:id */
export const DELETE = apiHandler(async (_req, ctx: Ctx) => {
  const { shop, id } = await context(ctx);
  await deleteMyProduct(shop, id);
  return json({ ok: true });
});
