import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { decideCampaign } from "@/lib/services/ads/sponsored";
import { campaignDecisionSchema } from "@/lib/validation/ads";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

/** PATCH /api/admin/campaigns/:id — { decision: "approve" } | { decision: "reject" | "cancel", reason } */
export const PATCH = apiHandler(async (req, ctx: RouteContext<"/api/admin/campaigns/[id]">) => {
  const admin = await requireApiUser(["admin"]);
  await decideCampaign(admin, objectIdSchema.parse((await ctx.params).id), await parseBody(req, campaignDecisionSchema));
  return json({ ok: true });
});
