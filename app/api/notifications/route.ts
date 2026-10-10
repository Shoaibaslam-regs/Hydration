import { apiHandler, json } from "@/lib/api/handler";
import { getSessionUser } from "@/lib/auth/session";
import { getNotificationCounts } from "@/lib/services/notifications";

/** GET /api/notifications — counts for the signed-in user's dashboard links ({} when signed out). */
export const GET = apiHandler(async () => {
  const user = await getSessionUser();
  const counts = user ? await getNotificationCounts(user) : {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return json({ counts, total });
});
