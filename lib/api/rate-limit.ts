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
    { key: hashKey(key) },
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

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

/**
 * Failed-attempt lock (login, registration): after `limit` failures within
 * `lockMs`, `key` is locked for `lockMs` from the last failure. Only failures
 * count, so people who get it right are never slowed down. Same collection as
 * rateLimit; the TTL index tidies old entries.
 */
export const failureLock = {
  /** Throws 429 (with the seconds left) while `key` is locked. */
  async check(key: string, limit: number, message: string): Promise<void> {
    await connectDB();
    const doc = await RateLimit.collection.findOne({ key: hashKey(`fail:${key}`) });
    const now = Date.now();
    if (doc && doc.count >= limit && doc.resetAt.getTime() > now) {
      throw ApiError.rateLimited(Math.max(1, Math.ceil((doc.resetAt.getTime() - now) / 1000)), message);
    }
  },

  /** Count one failure. Returns tries left, or the lock length in seconds once the limit is reached. */
  async record(key: string, limit: number, lockMs: number): Promise<{ attemptsLeft: number; lockedForSeconds: number | null }> {
    await connectDB();
    const now = new Date();
    const active = { $gt: ["$resetAt", now] };
    const doc = await RateLimit.collection.findOneAndUpdate(
      { key: hashKey(`fail:${key}`) },
      [
        // Failures inside the window add up; the window restarts from each failure, so the lock lasts lockMs from the last one.
        { $set: { count: { $cond: [active, { $add: ["$count", 1] }, 1] }, resetAt: new Date(now.getTime() + lockMs) } },
      ],
      { upsert: true, returnDocument: "after" },
    );
    const count = doc?.count ?? 1;
    return count >= limit
      ? { attemptsLeft: 0, lockedForSeconds: Math.ceil(lockMs / 1000) }
      : { attemptsLeft: limit - count, lockedForSeconds: null };
  },

  /** Forget the failures (e.g. after a successful login). */
  async clear(key: string): Promise<void> {
    await connectDB();
    await RateLimit.collection.deleteOne({ key: hashKey(`fail:${key}`) });
  },
};

/**
 * Best-effort client IP. X-Forwarded-For is only trustworthy behind a proxy
 * that overwrites it (e.g. Vercel, a load balancer); otherwise clients can set
 * it, so never rely on IP-keyed limits alone for anything security-critical.
 */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}
