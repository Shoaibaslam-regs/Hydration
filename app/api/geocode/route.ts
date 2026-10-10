import { z } from "zod";
import { apiHandler, json, parseQuery } from "@/lib/api/handler";
import { clientIp, rateLimit } from "@/lib/api/rate-limit";
import { getSessionUser } from "@/lib/auth/session";
import { geocode } from "@/lib/services/geocode";

const querySchema = z.object({ q: z.string().trim().min(3, "Type at least 3 characters").max(200) });

/** GET /api/geocode?q= — public: customers search a place on /shops before signing in. */
export const GET = apiHandler(async (req) => {
  const user = await getSessionUser();
  await rateLimit(user ? `geocode:${user.id}` : `geocode-ip:${clientIp(req)}`, 20, 60 * 1000);
  // The public Nominatim instance allows about one request per second for the whole site.
  await rateLimit("geocode:all", 60, 60 * 1000);
  const { q } = parseQuery(req, querySchema);
  return json({ items: await geocode(q.toLowerCase()) });
});
