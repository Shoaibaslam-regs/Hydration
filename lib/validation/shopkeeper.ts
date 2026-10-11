import { z } from "zod";
import { ORDER_STATUSES } from "@/lib/orders/status";
import { paginationSchema } from "./pagination";

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");
const phone = z.string().trim().regex(/^\+?[0-9][0-9\s-]{6,19}$/, "Enter a valid phone number");

export const shopInputSchema = z.object({
  name: z.string().trim().min(2, "Enter the shop name").max(120),
  description: z.string().trim().max(2000).default(""),
  phone,
  address: z.object({
    line1: z.string().trim().min(3, "Enter the street address").max(200),
    area: z.string().trim().max(100).default(""),
    city: z.string().trim().min(2, "Enter the city").max(100),
  }),
  location: z.object({
    lat: z.number({ error: "Set your shop's location" }).min(-90).max(90),
    lng: z.number({ error: "Set your shop's location" }).min(-180).max(180),
  }),
  deliveryRadiusKm: z.number({ error: "Enter a delivery radius" }).min(0.5, "At least 0.5 km").max(50, "At most 50 km"),
  /** Major currency units. */
  deliveryFee: z.number({ error: "Enter a delivery fee (0 for free)" }).min(0).max(100_000),
  /** Major currency units: price of one 19L can. */
  pricePerCan: z.number({ error: "Enter your price per can" }).positive("Price must be more than 0").max(100_000),
  hours: z
    .object({ opensAt: time, closesAt: time })
    .refine((h) => h.opensAt !== h.closesAt, { message: "Opening and closing times must differ", path: ["closesAt"] }),
});
export type ShopInput = z.infer<typeof shopInputSchema>;

export const orderListQuerySchema = paginationSchema.extend({
  status: z.preprocess((v) => (v === "" ? undefined : v), z.enum(ORDER_STATUSES).optional()),
});
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

export const orderStatusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(300).optional(),
});
export type OrderStatusUpdate = z.infer<typeof orderStatusUpdateSchema>;

export const shopClosureSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("close"), reason: z.string().trim().max(300).default("") }),
  z.object({ action: z.literal("reopen") }),
]);

export const shopDeleteSchema = z.object({
  confirmName: z.string().trim().min(1, "Type your shop's name to confirm").max(120),
});

/** Tag or untag an order's customer as a Star customer. */
export const starCustomerSchema = z.object({ star: z.boolean() });
