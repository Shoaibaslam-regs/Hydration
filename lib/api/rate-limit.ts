import "server-only";
import { createHash } from "node:crypto";
import { connectDB } from "@/lib/db/connect";
import { RateLimit } from "@/lib/db/models";
import { ApiError } from "./errors";

/**
 * Fixed-window rate limit stored in MongoDB, so it holds across server
 * instances and restarts. One atomic update either increments the current
 * window or starts a new one. Throws ApiError 429 when `key` exceeds `limit`
 * hits per `windowMs`.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  await connectDB();
  const now = new Date();
  const active = { $gt: ["$resetAt", now] };
  const doc = await RateLimit.collection.findOneAndUpdate(
    { key: createHash("sha256").update(key).digest("hex") },
    [
      {
        $set: {
          count: { $cond: [active, { $add: ["$count", 1] }, 1] },
          resetAt: { $cond: [active, "$resetAt", new Date(now.getTime() + windowMs)] },
        },
      },
    ],
    { upsert: true, returnDocument: "after" },
  );
  if (doc && doc.count > limit) {
    throw ApiError.rateLimited(Math.max(1, Math.ceil((doc.resetAt.getTime() - now.getTime()) / 1000)));
  }
}

/**
 * Best-effort client IP. X-Forwarded-For is only trustworthy behind a proxy
 * that overwrites it (e.g. Vercel, a load balancer); otherwise clients can set
 * it, so never rely on IP-keyed limits alone for anything security-critical.
 */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}
