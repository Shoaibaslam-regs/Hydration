import { z } from "zod";
import { MAX_SUPPORT_MESSAGE_LENGTH, SUPPORT_CATEGORIES, SUPPORT_STATUSES, SUPPORT_USER_ROLES } from "@/lib/support/constants";
import { paginationSchema } from "./pagination";

const body = z.string().trim().min(1, "Write a message").max(MAX_SUPPORT_MESSAGE_LENGTH, `Keep it under ${MAX_SUPPORT_MESSAGE_LENGTH} characters`);

export const supportThreadCreateSchema = z.object({
  category: z.enum(SUPPORT_CATEGORIES, { error: "Choose what it's about" }),
  subject: z.string().trim().min(3, "Add a short subject").max(120),
  body,
});
export type SupportThreadCreate = z.infer<typeof supportThreadCreateSchema>;

export const supportReplySchema = z.object({ body });

export const supportStatusSchema = z.object({ status: z.enum(SUPPORT_STATUSES) });

export const adminSupportListSchema = paginationSchema.extend({
  status: z.preprocess((v) => (v === "" ? undefined : v), z.enum([...SUPPORT_STATUSES, "all"]).optional()),
  role: z.preprocess((v) => (v === "" ? undefined : v), z.enum(SUPPORT_USER_ROLES).optional()),
});

/** The team starts a conversation with a customer or shopkeeper. */
export const adminSupportStartSchema = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i, "Unknown user"),
  subject: z.string().trim().min(3, "Add a short subject").max(120),
  body,
});
