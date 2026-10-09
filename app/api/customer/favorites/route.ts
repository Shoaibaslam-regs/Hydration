import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { addFavorite, listFavoriteShops } from "@/lib/services/favorites";
import { favoriteSchema } from "@/lib/validation/customer";

/** GET /api/customer/favorites */
export const GET = apiHandler(async () => {
  const user = await requireApiUser(["customer"]);
  return json({ items: await listFavoriteShops(user.id) });
});

/** POST /api/customer/favorites — { shopId } */
export const POST = apiHandler(async (req) => {
  const user = await requireApiUser(["customer"]);
  const { shopId } = await parseBody(req, favoriteSchema);
  await addFavorite(user.id, shopId);
  return json({ ok: true, favorite: true });
});
