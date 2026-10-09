import { z } from "zod";
import { USER_ROLES } from "@/lib/auth/roles";
import { ORDER_STATUSES } from "@/lib/orders/status";
import { paginationSchema } from "./pagination";
import { objectIdSchema } from "./shopkeeper";

const blank = (v: unknown) => (v === "" ? undefined : v);
const SHOP_STATUSES = ["pending", "verified", "rejected", "suspended"] as const;

export const adminShopListSchema = paginationSchema.extend({
  status: z.preprocess(blank, z.enum(SHOP_STATUSES).optional()),
  q: z.preprocess(blank, z.string().trim().max(100).optional()),
});
export type AdminShopListQuery = z.infer<typeof adminShopListSchema>;

export const adminShopStatusSchema = z.object({
  status: z.enum(SHOP_STATUSES),
  reason: z.string().trim().max(500).optional(),
});

export const adminUserListSchema = paginationSchema.extend({
  role: z.preprocess(blank, z.enum(USER_ROLES).optional()),
  status: z.preprocess(blank, z.enum(["active", "suspended"]).optional()),
  q: z.preprocess(blank, z.string().trim().max(100).optional()),
});
export type AdminUserListQuery = z.infer<typeof adminUserListSchema>;

export const adminUserUpdateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend"), reason: z.string().trim().min(1, "Give a reason").max(500) }),
  z.object({ action: z.literal("activate") }),
  z.object({ action: z.literal("signOutEverywhere") }),
]);
export type AdminUserUpdate = z.infer<typeof adminUserUpdateSchema>;

export const adminOrderListSchema = paginationSchema.extend({
  status: z.preprocess(blank, z.enum(ORDER_STATUSES).optional()),
  shopId: z.preprocess(blank, objectIdSchema.optional()),
  q: z.preprocess(blank, z.string().trim().max(40).optional()),
});
export type AdminOrderListQuery = z.infer<typeof adminOrderListSchema>;

export const adminOrderCancelSchema = z.object({
  reason: z.string().trim().min(1, "Give a reason").max(300),
});

export const analyticsRangeSchema = z.object({
  days: z.preprocess(blank, z.coerce.number().int().refine((d) => [7, 30, 90].includes(d), "Use 7, 30 or 90").default(30)),
});

export const adminShopClosureSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("close"), reason: z.string().trim().min(1, "Give a reason").max(300) }),
  z.object({ action: z.literal("reopen") }),
]);

export const adminShopRemoveSchema = z.object({
  reason: z.string().trim().min(1, "Give a reason").max(300),
});
