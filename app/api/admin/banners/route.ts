import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { createBanner, listBannersForAdmin } from "@/lib/services/ads/banners";
import { bannerInputSchema } from "@/lib/validation/ads";

/** GET /api/admin/banners */
export const GET = apiHandler(async () => {
  await requireApiUser(["admin"]);
  return json({ items: await listBannersForAdmin() });
});

/** POST /api/admin/banners */
export const POST = apiHandler(async (req) => {
  const admin = await requireApiUser(["admin"]);
  return json({ id: await createBanner(admin, await parseBody(req, bannerInputSchema)) }, 201);
});
