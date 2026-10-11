import "server-only";
import { Types } from "mongoose";
import { ApiError } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { AdminAction } from "@/lib/db/models";

export type AuditEntry = { id: string; adminName: string; action: string; reason: string; createdAt: string };

export async function logAdminAction(
  admin: SessionUser,
  action: string,
  targetType: "shop" | "user" | "order" | "platform",
  targetId: string | Types.ObjectId | null,
  reason = "",
): Promise<void> {
  await AdminAction.create({
    adminId: new Types.ObjectId(admin.id),
    adminName: admin.name,
    action,
    targetType,
    ...(targetId ? { targetId: new Types.ObjectId(targetId) } : {}),
    reason,
  });
}

export async function listAdminActions(
  targetType: "shop" | "user" | "order" | "platform",
  targetId: string | null,
  limit = 20,
): Promise<AuditEntry[]> {
  const rows = await AdminAction.find(targetId ? { targetType, targetId: new Types.ObjectId(targetId) } : { targetType })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return rows.map((r) => ({
    id: r._id.toString(),
    adminName: r.adminName,
    action: r.action,
    reason: r.reason ?? "",
    createdAt: r.createdAt.toISOString(),
  }));
}

type AuditTarget = "shop" | "user" | "order" | "platform";

/** Delete one history entry. */
export async function deleteAdminAction(entryId: string): Promise<void> {
  if (!Types.ObjectId.isValid(entryId)) throw ApiError.notFound("History entry not found");
  await connectDB();
  const res = await AdminAction.deleteOne({ _id: entryId });
  if (res.deletedCount === 0) throw ApiError.notFound("History entry not found");
}

/**
 * Clear a page's whole history (one shop, user, order, or the platform log).
 * Leaves a single "history cleared" entry so the history is never wiped
 * without a trace. Returns how many entries were removed.
 */
export async function clearAdminActions(admin: SessionUser, targetType: AuditTarget, targetId: string | null): Promise<number> {
  await connectDB();
  const filter = targetId ? { targetType, targetId: new Types.ObjectId(targetId) } : { targetType };
  const { deletedCount } = await AdminAction.deleteMany(filter);
  if (deletedCount > 0) await logAdminAction(admin, "history.cleared", targetType, targetId, `${deletedCount} ${deletedCount === 1 ? "entry" : "entries"}`);
  return deletedCount;
}
