import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/services/platform-settings";
import { settingsUpdateSchema } from "@/lib/validation/billing";

/** GET /api/admin/settings */
export const GET = apiHandler(async () => {
  await requireApiUser(["admin"]);
  return json(await getPlatformSettings());
});

/** PATCH /api/admin/settings — { requireSubscription?, paymentInstructions? } */
export const PATCH = apiHandler(async (req) => {
  const admin = await requireApiUser(["admin"]);
  return json(await updatePlatformSettings(admin, await parseBody(req, settingsUpdateSchema)));
});
