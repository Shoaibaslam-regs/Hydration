import "server-only";
import { Types } from "mongoose";
import { ApiError } from "@/lib/api/errors";
import { rateLimit } from "@/lib/api/rate-limit";
import type { SessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { Shop, SupportThread } from "@/lib/db/models";
import { MAX_SUPPORT_MESSAGES, type SupportCategory, type SupportStatus } from "@/lib/support/constants";
import { paginated, skipFor, type Paginated, type Pagination } from "@/lib/validation/pagination";
import type { SupportThreadCreate } from "@/lib/validation/support";
import { logAdminAction } from "./admin/audit";

export type SupportMessageDTO = { by: "shopkeeper" | "admin"; authorName: string; body: string; at: string };

export type SupportThreadSummary = {
  id: string;
  subject: string;
  category: SupportCategory;
  status: SupportStatus;
  shopName: string;
  lastMessageAt: string;
  lastMessageBy: "shopkeeper" | "admin";
  /** Preview of the latest message. */
  preview: string;
  messageCount: number;
  /** Unread for whoever is looking (shopkeeper or admin). */
  unread: boolean;
  createdAt: string;
};

export type SupportThreadDetail = SupportThreadSummary & {
  messages: SupportMessageDTO[];
  shopkeeperId: string;
  shopId: string | null;
};

type ThreadLean = {
  _id: Types.ObjectId;
  shopkeeperId: Types.ObjectId;
  shopId?: Types.ObjectId | null;
  shopName?: string | null;
  category: string;
  subject: string;
  status: string;
  messages: { by: string; authorName: string; body: string; at: Date }[];
  lastMessageAt: Date;
  lastMessageBy: string;
  unreadForAdmin?: boolean | null;
  unreadForShopkeeper?: boolean | null;
  createdAt: Date;
};

type Viewer = "shopkeeper" | "admin";

function toSummary(t: ThreadLean, viewer: Viewer): SupportThreadSummary {
  const last = t.messages.at(-1);
  return {
    id: t._id.toString(),
    subject: t.subject,
    category: t.category as SupportCategory,
    status: t.status as SupportStatus,
    shopName: t.shopName ?? "",
    lastMessageAt: t.lastMessageAt.toISOString(),
    lastMessageBy: t.lastMessageBy as Viewer,
    preview: last ? last.body.slice(0, 140) : "",
    messageCount: t.messages.length,
    unread: Boolean(viewer === "admin" ? t.unreadForAdmin : t.unreadForShopkeeper),
    createdAt: t.createdAt.toISOString(),
  };
}

function toDetail(t: ThreadLean, viewer: Viewer): SupportThreadDetail {
  return {
    ...toSummary(t, viewer),
    messages: t.messages.map((m) => ({ by: m.by as Viewer, authorName: m.authorName, body: m.body, at: m.at.toISOString() })),
    shopkeeperId: t.shopkeeperId.toString(),
    shopId: t.shopId ? t.shopId.toString() : null,
  };
}

const message = (user: SessionUser, by: Viewer, body: string, at: Date) => ({
  by,
  authorId: new Types.ObjectId(user.id),
  // Admins sign as the team, so replies don't depend on who's on duty.
  authorName: by === "admin" ? "Aqua team" : user.name,
  body,
  at,
});

/** Messages sent per hour per person, so a stuck script can't flood the inbox. */
const SEND_LIMIT = 30;

// ── Shopkeeper side ──────────────────────────────────────────────────────

/** Start a conversation with the Aqua team. Works before a shop is registered too. */
export async function createSupportThread(user: SessionUser, input: SupportThreadCreate): Promise<string> {
  await connectDB();
  await rateLimit(`support:${user.id}`, SEND_LIMIT, 60 * 60 * 1000);
  const shop = await Shop.findOne({ ownerId: new Types.ObjectId(user.id) }, { name: 1 }).lean();
  const now = new Date();
  const t = await SupportThread.create({
    shopkeeperId: user.id,
    shopId: shop?._id ?? null,
    shopName: shop?.name ?? "",
    category: input.category,
    subject: input.subject,
    status: "open",
    messages: [message(user, "shopkeeper", input.body, now)],
    lastMessageAt: now,
    lastMessageBy: "shopkeeper",
    unreadForAdmin: true,
    unreadForShopkeeper: false,
  });
  return t._id.toString();
}

export async function listMySupportThreads(userId: string, limit = 50): Promise<SupportThreadSummary[]> {
  await connectDB();
  const rows = await SupportThread.find({ shopkeeperId: new Types.ObjectId(userId), hiddenForShopkeeper: { $ne: true } })
    .sort({ lastMessageAt: -1 })
    .limit(limit)
    .lean();
  return rows.map((t) => toSummary(t as unknown as ThreadLean, "shopkeeper"));
}

/** One of the shopkeeper's own conversations; opening it marks the team's replies as read. */
export async function getMySupportThread(userId: string, threadId: string): Promise<SupportThreadDetail | null> {
  if (!Types.ObjectId.isValid(threadId)) return null;
  await connectDB();
  const t = (await SupportThread.findOne({ _id: threadId, shopkeeperId: new Types.ObjectId(userId), hiddenForShopkeeper: { $ne: true } }).lean()) as unknown as ThreadLean | null;
  if (!t) return null;
  if (t.unreadForShopkeeper) await SupportThread.updateOne({ _id: t._id }, { $set: { unreadForShopkeeper: false } });
  return toDetail(t, "shopkeeper");
}

/** Reply in your own conversation. Replying to a closed conversation reopens it. */
export async function replyAsShopkeeper(user: SessionUser, threadId: string, body: string): Promise<void> {
  await connectDB();
  await rateLimit(`support:${user.id}`, SEND_LIMIT, 60 * 60 * 1000);
  await appendMessage({ _id: threadId, shopkeeperId: new Types.ObjectId(user.id) }, message(user, "shopkeeper", body, new Date()), {
    status: "open",
    lastMessageBy: "shopkeeper",
    unreadForAdmin: true,
  });
}

/** The shopkeeper marks their own conversation as resolved (or reopens it). */
export async function setMySupportThreadStatus(userId: string, threadId: string, status: SupportStatus): Promise<void> {
  await connectDB();
  const res = await SupportThread.updateOne({ _id: threadId, shopkeeperId: new Types.ObjectId(userId) }, { $set: { status } });
  if (res.matchedCount === 0) throw ApiError.notFound("Conversation not found");
}

// ── Admin side ───────────────────────────────────────────────────────────

/** Unread first, then open before closed, newest activity first. */
export async function listSupportThreadsForAdmin(
  query: Pagination & { status?: SupportStatus | "all" },
): Promise<Paginated<SupportThreadSummary>> {
  await connectDB();
  const status = query.status ?? "open";
  const filter = status === "all" ? {} : { status };
  const [rows, total] = await Promise.all([
    SupportThread.find(filter, { messages: { $slice: -1 } })
      .sort({ unreadForAdmin: -1, lastMessageAt: -1, _id: -1 })
      .skip(skipFor(query))
      .limit(query.limit)
      .lean(),
    SupportThread.countDocuments(filter),
  ]);
  // `messages` was sliced to the last one, so fetch the real counts separately.
  const counts = await SupportThread.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { _id: { $in: rows.map((r) => r._id) } } },
    { $project: { n: { $size: "$messages" } } },
  ]);
  const byId = new Map(counts.map((c) => [c._id.toString(), c.n]));
  return paginated(
    rows.map((t) => ({ ...toSummary(t as unknown as ThreadLean, "admin"), messageCount: byId.get(t._id.toString()) ?? 1 })),
    total,
    query,
  );
}

/** Any conversation; opening it marks the shopkeeper's messages as read for the team. */
export async function getSupportThreadForAdmin(threadId: string): Promise<SupportThreadDetail | null> {
  if (!Types.ObjectId.isValid(threadId)) return null;
  await connectDB();
  const t = (await SupportThread.findById(threadId).lean()) as unknown as ThreadLean | null;
  if (!t) return null;
  if (t.unreadForAdmin) await SupportThread.updateOne({ _id: t._id }, { $set: { unreadForAdmin: false } });
  return toDetail(t, "admin");
}

/** Reply as the Aqua team. The shopkeeper sees a notification until they open it. */
export async function replyAsAdmin(admin: SessionUser, threadId: string, body: string): Promise<void> {
  await connectDB();
  await appendMessage({ _id: threadId }, message(admin, "admin", body, new Date()), {
    lastMessageBy: "admin",
    unreadForShopkeeper: true,
    unreadForAdmin: false,
    // A new reply brings back a conversation the shopkeeper had deleted.
    hiddenForShopkeeper: false,
  });
}

export async function setSupportThreadStatusAsAdmin(threadId: string, status: SupportStatus): Promise<void> {
  await connectDB();
  const res = await SupportThread.updateOne({ _id: threadId }, { $set: { status, ...(status === "closed" && { unreadForAdmin: false }) } });
  if (res.matchedCount === 0) throw ApiError.notFound("Conversation not found");
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

/** The shopkeeper deletes a conversation from their list. The team keeps it until they delete it too. */
export async function hideMySupportThread(userId: string, threadId: string): Promise<void> {
  await connectDB();
  if (!Types.ObjectId.isValid(threadId)) throw ApiError.notFound("Conversation not found");
  const res = await SupportThread.updateOne(
    { _id: threadId, shopkeeperId: new Types.ObjectId(userId) },
    { $set: { hiddenForShopkeeper: true, unreadForShopkeeper: false } },
  );
  if (res.matchedCount === 0) throw ApiError.notFound("Conversation not found");
}

/** Admin deletes a conversation permanently, for everyone. Audited. */
export async function deleteSupportThread(admin: SessionUser, threadId: string): Promise<void> {
  await connectDB();
  if (!Types.ObjectId.isValid(threadId)) throw ApiError.notFound("Conversation not found");
  const t = await SupportThread.findOneAndDelete({ _id: threadId }, { projection: { subject: 1, shopkeeperId: 1 } }).lean();
  if (!t) throw ApiError.notFound("Conversation not found");
  await logAdminAction(admin, "support.deleted", "user", t.shopkeeperId, `"${t.subject}"`);
}
