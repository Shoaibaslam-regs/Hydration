import { apiHandler, json, parseBody, parseQuery } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { createMyProduct, listMyProducts } from "@/lib/services/my-products";
import { requireMyShop } from "@/lib/services/my-shop";
import { productInputSchema, productListQuerySchema } from "@/lib/validation/shopkeeper";

/** GET /api/shopkeeper/products?q=&stock=low|out&page=&limit= */
export const GET = apiHandler(async (req) => {
  const user = await requireApiUser(["shopkeeper"]);
  const shop = await requireMyShop(user.id);
  return json(await listMyProducts(shop, parseQuery(req, productListQuerySchema)));
});

/** POST /api/shopkeeper/products */
export const POST = apiHandler(async (req) => {
  const user = await requireApiUser(["shopkeeper"]);
  const shop = await requireMyShop(user.id);
  const input = await parseBody(req, productInputSchema);
  return json(await createMyProduct(shop, input), 201);
});
