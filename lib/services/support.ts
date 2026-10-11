import "server-only";
import { Types } from "mongoose";
import { ApiError } from "@/lib/api/errors";
import { rateLimit } from "@/lib/api/rate-limit";
import type { SessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { Shop, SupportThread, User } from "@/lib/db/models";
import {
  MAX_SUPPORT_MESSAGES,
  SUPPORT_CATEGORIES_FOR,
  type SupportCategory,
  type SupportStatus,
  type SupportUserRole,
} from "@/lib/support/constants";
import { paginated, skipFor, type Paginated, type Pagination } from "@/lib/validation/pagination";
import type { SupportThreadCreate } from "@/lib/validation/support";
import { logAdminAction } from "./admin/audit";

type Author = SupportUserRole | "admin";

export type SupportMessageDTO = { by: Author; authorName: string; body: string; at: string };

export type SupportThreadSummary = {
  id: string;
  subject: string;
  category: SupportCategory;
  status: SupportStatus;
  /** Who started it: a customer or a shopkeeper. */
  userRole: SupportUserRole;
  /** A shopkeeper's shop name (empty for customers). */
  shopName: string;
  lastMessageAt: string;
  lastMessageBy: Author;
  /** Preview of the latest message. */
  preview: string;
  messageCount: number;
  /** Unread for whoever is looking (the user or the team). */
  unread: boolean;
  /** The user's name and "CU-…"/"SK-…" ID; filled in for admins only. */
  userName: string;
  userPublicId: string;
  createdAt: string;
};

export type SupportThreadDetail = SupportThreadSummary & {
  messages: SupportMessageDTO[];
  userId: string;
  shopId: string | null;
};

type ThreadLean = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  userRole: string;
  shopId?: Types.ObjectId | null;
  shopName?: string | null;
  category: string;
  subject: string;
  status: string;
  messages: { by: string; authorName: string; body: string; at: Date }[];
  lastMessageAt: Date;
  lastMessageBy: string;
  unreadForAdmin?: boolean | null;
  unreadForUser?: boolean | null;
  createdAt: Date;
};

type Viewer = "user" | "admin";

function toSummary(t: ThreadLean, viewer: Viewer): SupportThreadSummary {
  const last = t.messages.at(-1);
  return {
    id: t._id.toString(),
    subject: t.subject,
    category: t.category as SupportCategory,
    status: t.status as SupportStatus,
    userRole: t.userRole as SupportUserRole,
    shopName: t.shopName ?? "",
    lastMessageAt: t.lastMessageAt.toISOString(),
    lastMessageBy: t.lastMessageBy as Author,
    preview: last ? last.body.slice(0, 140) : "",
    messageCount: t.messages.length,
    unread: Boolean(viewer === "admin" ? t.unreadForAdmin : t.unreadForUser),
    userName: "",
    userPublicId: "",
    createdAt: t.createdAt.toISOString(),
  };
}

function toDetail(t: ThreadLean, viewer: Viewer): SupportThreadDetail {
  return {
    ...toSummary(t, viewer),
    messages: t.messages.map((m) => ({ by: m.by as Author, authorName: m.authorName, body: m.body, at: m.at.toISOString() })),
    userId: t.userId.toString(),
    shopId: t.shopId ? t.shopId.toString() : null,
  };
}

const message = (user: SessionUser, by: Author, body: string, at: Date) => ({
  by,
  authorId: new Types.ObjectId(user.id),
  // Admins sign as the team, so replies don't depend on who's on duty.
  authorName: by === "admin" ? "Aqua team" : user.name,
  body,
  at,
});

/** Messages sent per hour per person, so a stuck script can't flood the inbox. */
const SEND_LIMIT = 30;

const supportRole = (user: SessionUser): SupportUserRole => {
  if (user.role !== "customer" && user.role !== "shopkeeper") throw ApiError.forbidden("Only customers and shopkeepers can contact support");
  return user.role;
};

const mine = (userId: string) => ({ userId: new Types.ObjectId(userId), hiddenForUser: { $ne: true } });

// ── Customer / shopkeeper side ───────────────────────────────────────────

/**
 * Start a conversation with the Aqua team. Shopkeepers' threads note their
 * shop (they don't need one yet). The topic must be one offered to the role.
 */
export async function createSupportThread(user: SessionUser, input: SupportThreadCreate): Promise<string> {
  const role = supportRole(user);
  if (!(SUPPORT_CATEGORIES_FOR[role] as readonly string[]).includes(input.category)) {
    throw ApiError.badRequest("Choose one of the topics listed", { fieldErrors: { category: ["Choose one of the topics listed"] } });
  }
  await connectDB();
  await rateLimit(`support:${user.id}`, SEND_LIMIT, 60 * 60 * 1000);
  const shop = role === "shopkeeper" ? await Shop.findOne({ ownerId: new Types.ObjectId(user.id) }, { name: 1 }).lean() : null;
  const now = new Date();
  const t = await SupportThread.create({
    userId: user.id,
    userRole: role,
    shopId: shop?._id ?? null,
    shopName: shop?.name ?? "",
    category: input.category,
    subject: input.subject,
    status: "open",
    messages: [message(user, role, input.body, now)],
    lastMessageAt: now,
    lastMessageBy: role,
    unreadForAdmin: true,
    unreadForUser: false,
  });
  return t._id.toString();
}

export async function listMySupportThreads(userId: string, limit = 50): Promise<SupportThreadSummary[]> {
  await connectDB();
  const rows = await SupportThread.find(mine(userId)).sort({ lastMessageAt: -1 }).limit(limit).lean();
  return rows.map((t) => toSummary(t as unknown as ThreadLean, "user"));
}

/** One of your own conversations; opening it marks the team's replies as read. */
export async function getMySupportThread(userId: string, threadId: string): Promise<SupportThreadDetail | null> {
  if (!Types.ObjectId.isValid(threadId)) return null;
  await connectDB();
  const t = (await SupportThread.findOne({ _id: threadId, ...mine(userId) }).lean()) as unknown as ThreadLean | null;
  if (!t) return null;
  if (t.unreadForUser) await SupportThread.updateOne({ _id: t._id }, { $set: { unreadForUser: false } });
  return toDetail(t, "user");
}

/** Reply in your own conversation. Replying to a resolved conversation reopens it. */
export async function replyAsUser(user: SessionUser, threadId: string, body: string): Promise<void> {
  const role = supportRole(user);
  await connectDB();
  await rateLimit(`support:${user.id}`, SEND_LIMIT, 60 * 60 * 1000);
  await appendMessage({ _id: threadId, ...mine(user.id) }, message(user, role, body, new Date()), {
    status: "open",
    lastMessageBy: role,
    unreadForAdmin: true,
  });
}

/** Mark your own conversation as resolved (or reopen it). */
export async function setMySupportThreadStatus(userId: string, threadId: string, status: SupportStatus): Promise<void> {
  await connectDB();
  if (!Types.ObjectId.isValid(threadId)) throw ApiError.notFound("Conversation not found");
  const res = await SupportThread.updateOne({ _id: threadId, ...mine(userId) }, { $set: { status } });
  if (res.matchedCount === 0) throw ApiError.notFound("Conversation not found");
}

/** Delete a conversation from your list. The team keeps it until they delete it too. */
export async function hideMySupportThread(userId: string, threadId: string): Promise<void> {
  await connectDB();
  if (!Types.ObjectId.isValid(threadId)) throw ApiError.notFound("Conversation not found");
  const res = await SupportThread.updateOne(
    { _id: threadId, userId: new Types.ObjectId(userId) },
    { $set: { hiddenForUser: true, unreadForUser: false } },
  );
  if (res.matchedCount === 0) throw ApiError.notFound("Conversation not found");
}

// ── Admin side ───────────────────────────────────────────────────────────

/** Unread first, then newest activity. Filter by status and by who wrote in. */
export async function listSupportThreadsForAdmin(
  query: Pagination & { status?: SupportStatus | "all"; role?: SupportUserRole },
): Promise<Paginated<SupportThreadSummary>> {
  await connectDB();
  const status = query.status ?? "open";
  const filter: Record<string, unknown> = status === "all" ? {} : { status };
  if (query.role) filter.userRole = query.role;
  const [rows, total] = await Promise.all([
    SupportThread.find(filter, { messages: { $slice: -1 } })
      .sort({ unreadForAdmin: -1, lastMessageAt: -1, _id: -1 })
      .skip(skipFor(query))
      .limit(query.limit)
      .lean(),
    SupportThread.countDocuments(filter),
  ]);
  // `messages` was sliced to the last one, so fetch the real counts separately.
  const [counts, users] = await Promise.all([
    SupportThread.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { _id: { $in: rows.map((r) => r._id) } } },
      { $project: { n: { $size: "$messages" } } },
    ]),
    User.find({ _id: { $in: rows.map((r) => r.userId) } }, { name: 1, publicId: 1 }).lean(),
  ]);
  const countById = new Map(counts.map((c) => [c._id.toString(), c.n]));
  const userById = new Map(users.map((u) => [u._id.toString(), u]));
  return paginated(
    rows.map((t) => {
      const u = userById.get(t.userId.toString());
      return {
        ...toSummary(t as unknown as ThreadLean, "admin"),
        messageCount: countById.get(t._id.toString()) ?? 1,
        userName: u?.name ?? "Deleted account",
        userPublicId: u?.publicId ?? "",
      };
    }),
    total,
    query,
  );
}

/** Any conversation; opening it marks the user's messages as read for the team. */
export async function getSupportThreadForAdmin(threadId: string): Promise<SupportThreadDetail | null> {
  if (!Types.ObjectId.isValid(threadId)) return null;
  await connectDB();
  const t = (await SupportThread.findById(threadId).lean()) as unknown as ThreadLean | null;
  if (!t) return null;
  if (t.unreadForAdmin) await SupportThread.updateOne({ _id: t._id }, { $set: { unreadForAdmin: false } });
  const u = await User.findById(t.userId, { name: 1, publicId: 1 }).lean();
  return { ...toDetail(t, "admin"), userName: u?.name ?? "Deleted account", userPublicId: u?.publicId ?? "" };
}

/**
 * The team starts a conversation with a customer or shopkeeper (a heads-up,
 * a congratulation…). It lands in their support inbox as unread. Audited on the user.
 */
export async function startSupportThreadAsAdmin(
  admin: SessionUser,
  userId: string,
  input: { subject: string; body: string },
): Promise<string> {
  if (!Types.ObjectId.isValid(userId)) throw ApiError.notFound("User not found");
  await connectDB();
  const user = await User.findById(userId, { role: 1 }).lean();
  if (!user) throw ApiError.notFound("User not found");
  if (user.role !== "customer" && user.role !== "shopkeeper") throw ApiError.badRequest("You can only message customers and shopkeepers");
  const role = user.role as SupportUserRole;
  const shop = role === "shopkeeper" ? await Shop.findOne({ ownerId: user._id }, { name: 1 }).lean() : null;
  const now = new Date();
  const t = await SupportThread.create({
    userId: user._id,
    userRole: role,
    shopId: shop?._id ?? null,
    shopName: shop?.name ?? "",
    category: "aqua",
    subject: input.subject,
    status: "open",
    messages: [message(admin, "admin", input.body, now)],
    lastMessageAt: now,
    lastMessageBy: "admin",
    unreadForAdmin: false,
    unreadForUser: true,
  });
  await logAdminAction(admin, "support.sent", "user", user._id, `"${input.subject}"`);
  return t._id.toString();
}

/** Reply as the Aqua team. The user sees a notification until they open it. */
export async function replyAsAdmin(admin: SessionUser, threadId: string, body: string): Promise<void> {
  await connectDB();
  await appendMessage({ _id: threadId }, message(admin, "admin", body, new Date()), {
    lastMessageBy: "admin",
    unreadForUser: true,
    unreadForAdmin: false,
    // A new reply brings back a conversation the user had deleted.
    hiddenForUser: false,
  });
}

export async function setSupportThreadStatusAsAdmin(threadId: string, status: SupportStatus): Promise<void> {
  await connectDB();
  if (!Types.ObjectId.isValid(threadId)) throw ApiError.notFound("Conversation not found");
  const res = await SupportThread.updateOne({ _id: threadId }, { $set: { status, ...(status === "closed" && { unreadForAdmin: false }) } });
  if (res.matchedCount === 0) throw ApiError.notFound("Conversation not found");
}

/** Admin deletes a conversation permanently, for everyone. Audited on the user. */
export async function deleteSupportThread(admin: SessionUser, threadId: string): Promise<void> {
  await connectDB();
  if (!Types.ObjectId.isValid(threadId)) throw ApiError.notFound("Conversation not found");
  const t = await SupportThread.findOneAndDelete({ _id: threadId }, { projection: { subject: 1, userId: 1 } }).lean();
  if (!t) throw ApiError.notFound("Conversation not found");
  await logAdminAction(admin, "support.deleted", "user", t.userId, `"${t.subject}"`);
}

/** Push a message unless the conversation is full (checked atomically in the filter). */
async function appendMessage(filter: Record<string, unknown>, msg: ReturnType<typeof message>, set: Record<string, unknown>) {
  if (!Types.ObjectId.isValid(String(filter._id))) throw ApiError.notFound("Conversation not found");
  const res = await SupportThread.updateOne(
    { ...filter, [`messages.${MAX_SUPPORT_MESSAGES - 1}`]: { $exists: false } },
    { $push: { messages: msg }, $set: { ...set, lastMessageAt: msg.at } },
  );
  if (res.matchedCount === 0) {
    if (!(await SupportThread.exists(filter))) throw ApiError.notFound("Conversation not found");
    throw ApiError.conflict("This conversation is full. Please start a new one.");
  }
}
