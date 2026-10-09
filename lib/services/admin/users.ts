import "server-only";
import { Types } from "mongoose";
import { ApiError } from "@/lib/api/errors";
import type { UserRole } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { Order, Shop, User } from "@/lib/db/models";
import type { ShopStatus } from "@/lib/admin/shop-status";
import { paginated, skipFor, type Paginated } from "@/lib/validation/pagination";
import type { AdminUserListQuery, AdminUserUpdate } from "@/lib/validation/admin";
import { listAdminActions, logAdminAction, type AuditEntry } from "./audit";

export type AdminUserSummary = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: "active" | "suspended";
  createdAt: string;
  lastLoginAt: string | null;
};

export type AdminUserDetail = AdminUserSummary & {
  orderCount: number;
  shop: { id: string; name: string; slug: string; status: ShopStatus } | null;
  history: AuditEntry[];
};

type UserLean = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  status: string;
  createdAt: Date;
  lastLoginAt?: Date | null;
};

function toSummary(u: UserLean): AdminUserSummary {
  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    phone: u.phone ?? "",
    role: u.role as UserRole,
    status: u.status as "active" | "suspended",
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
  };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PROJECTION = { name: 1, email: 1, phone: 1, role: 1, status: 1, createdAt: 1, lastLoginAt: 1 };

export async function listAdminUsers(query: AdminUserListQuery): Promise<Paginated<AdminUserSummary>> {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const [rows, total] = await Promise.all([
    User.find(filter, PROJECTION).sort({ createdAt: -1, _id: -1 }).skip(skipFor(query)).limit(query.limit).lean(),
    User.countDocuments(filter),
  ]);
  return paginated(rows.map((u) => toSummary(u as unknown as UserLean)), total, query);
}

export async function getAdminUser(userId: string): Promise<AdminUserDetail | null> {
  if (!Types.ObjectId.isValid(userId)) return null;
  await connectDB();
  const u = await User.findById(userId, PROJECTION).lean();
  if (!u) return null;
  const id = new Types.ObjectId(userId);
  const [orderCount, shop, history] = await Promise.all([
    u.role === "customer" ? Order.countDocuments({ customerId: id }) : Promise.resolve(0),
    u.role === "shopkeeper" ? Shop.findOne({ ownerId: id }, { name: 1, slug: 1, status: 1 }).lean() : Promise.resolve(null),
    listAdminActions("user", userId),
  ]);
  return {
    ...toSummary(u as unknown as UserLean),
    orderCount,
    shop: shop ? { id: shop._id.toString(), name: shop.name, slug: shop.slug, status: shop.status as ShopStatus } : null,
    history,
  };
}

/**
 * Suspend/activate a user or sign them out everywhere. Suspension takes effect
 * on their next request (sessions are checked against the DB). Admins can't
 * change their own account here, so there's always a way back in.
 */
export async function updateAdminUser(admin: SessionUser, userId: string, update: AdminUserUpdate): Promise<void> {
  await connectDB();
  if (userId === admin.id) throw ApiError.forbidden("You can't change your own account from the admin panel");
  const user = await User.findById(userId, { status: 1 }).lean();
  if (!user) throw ApiError.notFound("User not found");

  switch (update.action) {
    case "suspend":
      if (user.status === "suspended") throw ApiError.conflict("This user is already suspended");
      await User.updateOne({ _id: user._id }, { $set: { status: "suspended" }, $inc: { sessionVersion: 1 } });
      await logAdminAction(admin, "user.suspend", "user", user._id, update.reason);
      return;
    case "activate":
      if (user.status === "active") throw ApiError.conflict("This user is already active");
      await User.updateOne({ _id: user._id }, { $set: { status: "active" } });
      await logAdminAction(admin, "user.activate", "user", user._id);
      return;
    case "signOutEverywhere":
      await User.updateOne({ _id: user._id }, { $inc: { sessionVersion: 1 } });
      await logAdminAction(admin, "user.signOutEverywhere", "user", user._id);
      return;
  }
}
