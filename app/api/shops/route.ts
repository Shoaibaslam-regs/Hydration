import { apiHandler, json, parseQuery } from "@/lib/api/handler";
import { searchShops } from "@/lib/services/shops";
import { shopSearchSchema } from "@/lib/validation/shops";

/** GET /api/shops?lat=&lng=&radiusKm=&q=&type=&maxPrice=&minRating=&sort=&page=&limit= */
export const GET = apiHandler(async (req) => {
  const input = parseQuery(req, shopSearchSchema);
  return json(await searchShops(input));
});
