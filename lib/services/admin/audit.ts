import "server-only";
import { Types } from "mongoose";
import type { SessionUser } from "@/lib/auth/session";
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
