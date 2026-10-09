import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { closeMyShop, reopenMyShop } from "@/lib/services/my-shop";
import { shopClosureSchema } from "@/lib/validation/shopkeeper";

/** POST /api/shopkeeper/shop/closure — { action: "close", reason? } | { action: "reopen" } */
export const POST = apiHandler(async (req) => {
  const user = await requireApiUser(["shopkeeper"]);
  const input = await parseBody(req, shopClosureSchema);
  return json(input.action === "close" ? await closeMyShop(user.id, input.reason) : await reopenMyShop(user.id));
});
