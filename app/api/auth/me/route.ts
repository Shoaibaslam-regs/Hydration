import { apiHandler, json } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";

/** GET /api/auth/me — the signed-in user, or 401. */
export const GET = apiHandler(async () => {
  return json({ user: await requireApiUser() });
});
