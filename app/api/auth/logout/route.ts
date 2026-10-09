import { apiHandler, json } from "@/lib/api/handler";
import { deleteSession } from "@/lib/auth/session";

/** POST /api/auth/logout */
export const POST = apiHandler(async () => {
  await deleteSession();
  return json({ ok: true });
});
