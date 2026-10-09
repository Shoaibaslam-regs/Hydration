import { z } from "zod";
import { apiHandler, json, parseQuery } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { requireApiUser } from "@/lib/auth/session";
import { geocode } from "@/lib/services/geocode";

const querySchema = z.object({ q: z.string().trim().min(3, "Type at least 3 characters").max(200) });

/** GET /api/geocode?q= — signed-in users only (shop registration, saved addresses). */
export const GET = apiHandler(async (req) => {
  const user = await requireApiUser();
  await rateLimit(`geocode:${user.id}`, 20, 60 * 1000);
  const { q } = parseQuery(req, querySchema);
  return json({ items: await geocode(q.toLowerCase()) });
});
