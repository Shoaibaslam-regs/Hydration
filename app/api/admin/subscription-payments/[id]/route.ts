import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { approveSubscriptionPayment, rejectSubscriptionPayment } from "@/lib/services/billing";
import { adminPaymentDecisionSchema } from "@/lib/validation/billing";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

/** PATCH /api/admin/subscription-payments/:id — { decision: "approve" } | { decision: "reject", reason } */
export const PATCH = apiHandler(async (req, ctx: RouteContext<"/api/admin/subscription-payments/[id]">) => {
  const admin = await requireApiUser(["admin"]);
  const id = objectIdSchema.parse((await ctx.params).id);
  const input = await parseBody(req, adminPaymentDecisionSchema);
  if (input.decision === "approve") return json(await approveSubscriptionPayment(admin, id));
  await rejectSubscriptionPayment(admin, id, input.reason);
  return json({ ok: true });
});
