import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { requireApiUser } from "@/lib/auth/session";
import { getMyBilling, submitSubscriptionPayment } from "@/lib/services/billing";
import { requireMyShop } from "@/lib/services/my-shop";
import { paymentSubmitSchema } from "@/lib/validation/billing";

/** GET /api/shopkeeper/billing — current plan and recent subscription payments. */
export const GET = apiHandler(async () => {
  const user = await requireApiUser(["shopkeeper"]);
  return json(await getMyBilling(await requireMyShop(user.id, { allowLocked: true })));
});

/** POST /api/shopkeeper/billing — record a payment made outside the site, for admin review. */
export const POST = apiHandler(async (req) => {
  const user = await requireApiUser(["shopkeeper"]);
  await rateLimit(`billing:${user.id}`, 10, 60 * 60 * 1000);
  const shop = await requireMyShop(user.id, { allowLocked: true });
  return json(await submitSubscriptionPayment(shop, user.id, await parseBody(req, paymentSubmitSchema)), 201);
});
