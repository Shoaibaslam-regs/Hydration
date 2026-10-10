import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { clientIp, rateLimit } from "@/lib/api/rate-limit";
import { recordAdEvent } from "@/lib/services/ads/stats";
import { adEventSchema } from "@/lib/validation/ads";

/** POST /api/ads/event — { kind, id }: an ad came into view. Public; counts are approximate by design. */
export const POST = apiHandler(async (req) => {
  await rateLimit(`ad-event:${clientIp(req)}`, 300, 60 * 60 * 1000);
  const { kind, id } = await parseBody(req, adEventSchema);
  await recordAdEvent(kind, id, "impression");
  return json({ ok: true });
});
