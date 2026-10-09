import { ApiError } from "@/lib/api/errors";
import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { getProfile, updateProfile } from "@/lib/services/users";
import { profileUpdateSchema } from "@/lib/validation/customer";

/** GET /api/customer/profile */
export const GET = apiHandler(async () => {
  const user = await requireApiUser(["customer"]);
  const profile = await getProfile(user.id);
  if (!profile) throw ApiError.notFound();
  return json(profile);
});

/** PATCH /api/customer/profile — { name, phone? } */
export const PATCH = apiHandler(async (req) => {
  const user = await requireApiUser(["customer"]);
  await updateProfile(user.id, await parseBody(req, profileUpdateSchema));
  return json(await getProfile(user.id));
});
