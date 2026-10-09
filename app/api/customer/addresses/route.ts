import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { createAddress, listAddresses } from "@/lib/services/addresses";
import { addressInputSchema } from "@/lib/validation/customer";

/** GET /api/customer/addresses */
export const GET = apiHandler(async () => {
  const user = await requireApiUser(["customer"]);
  return json({ items: await listAddresses(user.id) });
});

/** POST /api/customer/addresses */
export const POST = apiHandler(async (req) => {
  const user = await requireApiUser(["customer"]);
  return json(await createAddress(user.id, await parseBody(req, addressInputSchema)), 201);
});
