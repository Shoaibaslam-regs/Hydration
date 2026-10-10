import { apiHandler, json, parseQuery } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { listSubscriptionPayments } from "@/lib/services/billing";
import { adminPaymentListSchema } from "@/lib/validation/billing";

/** GET /api/admin/subscription-payments?status=pending|approved|rejected&page=&limit= */
export const GET = apiHandler(async (req) => {
  await requireApiUser(["admin"]);
  return json(await listSubscriptionPayments(parseQuery(req, adminPaymentListSchema)));
});
