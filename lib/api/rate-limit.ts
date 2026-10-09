import "server-only";
import { ApiError } from "./errors";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Fixed-window, in-memory rate limit. Per server instance only: good enough
 * for one Node process; move to a shared store (e.g. Redis) before scaling out.
 * Throws ApiError 429 when `key` exceeds `limit` hits per `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) throw ApiError.rateLimited(Math.ceil((bucket.resetAt - now) / 1000));
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}
