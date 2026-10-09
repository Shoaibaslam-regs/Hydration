import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { clientIp, rateLimit } from "@/lib/api/rate-limit";
import { resetPasswordWithToken } from "@/lib/services/password-reset";
import { resetPasswordSchema } from "@/lib/validation/auth";

/** POST /api/auth/reset-password — { token, password } */
export const POST = apiHandler(async (req) => {
  await rateLimit(`reset:${clientIp(req)}`, 20, 15 * 60 * 1000);
  const { token, password } = await parseBody(req, resetPasswordSchema);
  await resetPasswordWithToken(token, password);
  return json({ ok: true });
});
