import { apiHandler, json, parseQuery } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { listAdminUsers } from "@/lib/services/admin/users";
import { adminUserListSchema } from "@/lib/validation/admin";

/** GET /api/admin/users?role=&status=&q=&page=&limit= */
export const GET = apiHandler(async (req) => {
  await requireApiUser(["admin"]);
  return json(await listAdminUsers(parseQuery(req, adminUserListSchema)));
});
