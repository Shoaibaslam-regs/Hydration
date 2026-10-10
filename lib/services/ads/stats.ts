import "server-only";
import { Types } from "mongoose";
import type { AdKind } from "@/lib/ads/constants";
import { dayKey } from "@/lib/ads/dates";
import { connectDB } from "@/lib/db/connect";
import { AdStat } from "@/lib/db/models";

/** Count one impression or click for a sponsored shop or a banner, in today's bucket. */
export async function recordAdEvent(kind: AdKind, refId: string | Types.ObjectId, event: "impression" | "click"): Promise<void> {
  await connectDB();
  await AdStat.updateOne(
    { kind, refId: new Types.ObjectId(refId), day: dayKey(new Date()) },
    { $inc: { [event === "impression" ? "impressions" : "clicks"]: 1 } },
    { upsert: true },
  );
}

export type AdTotals = { impressions: number; clicks: number };

/** Totals over the last `days` days per refId. */
export async function adTotals(kind: AdKind, refIds: (string | Types.ObjectId)[], days: number): Promise<Map<string, AdTotals>> {
  await connectDB();
  const since = dayKey(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
  const rows = await AdStat.aggregate<{ _id: Types.ObjectId; impressions: number; clicks: number }>([
    { $match: { kind, refId: { $in: refIds.map((id) => new Types.ObjectId(id)) }, day: { $gte: since } } },
    { $group: { _id: "$refId", impressions: { $sum: "$impressions" }, clicks: { $sum: "$clicks" } } },
  ]);
  return new Map(rows.map((r) => [r._id.toString(), { impressions: r.impressions, clicks: r.clicks }]));
}
