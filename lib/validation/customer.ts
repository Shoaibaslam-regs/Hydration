import { z } from "zod";
import { MAX_CART_LINES, MAX_LINE_QUANTITY } from "@/lib/orders/cart";
import { ORDER_STATUSES } from "@/lib/orders/status";
import { paginationSchema } from "./pagination";
import { objectIdSchema } from "./shopkeeper";

const phone = z.string().trim().regex(/^\+?[0-9][0-9\s-]{6,19}$/, "Enter a valid phone number");

const latLng = z.object(
  {
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  },
  { error: "Pin the address on the map" },
);

export const addressInputSchema = z.object({
  label: z.string().trim().min(1, "Give this address a name, e.g. Home").max(40),
  line1: z.string().trim().min(3, "Enter the street address").max(200),
  area: z.string().trim().max(100).default(""),
  city: z.string().trim().min(2, "Enter the city").max(100),
  notes: z.string().trim().max(300).default(""),
  location: latLng,
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.infer<typeof addressInputSchema>;

export const orderCreateSchema = z.object({
  shopSlug: z.string().max(140),
  items: z
    .array(
      z.object({
        productId: objectIdSchema,
        quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
      }),
    )
    .min(1, "Your order is empty")
    .max(MAX_CART_LINES)
    .refine((items) => new Set(items.map((i) => i.productId)).size === items.length, "Duplicate products in order"),
  addressId: objectIdSchema,
  contactPhone: phone,
  notes: z.string().trim().max(300).default(""),
});
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;

export const customerOrderListSchema = paginationSchema.extend({
  status: z.preprocess((v) => (v === "" ? undefined : v), z.enum(ORDER_STATUSES).optional()),
});

export const customerCancelSchema = z.object({
  note: z.string().trim().max(300).optional(),
});

export const reviewInputSchema = z.object({
  rating: z.number({ error: "Choose a rating" }).int().min(1, "Choose a rating").max(5),
  comment: z.string().trim().max(1000).default(""),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z.preprocess((v) => (v === "" ? undefined : v), phone.optional()),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(200),
  newPassword: z
    .string()
    .min(8, "Use at least 8 characters")
    .refine((p) => new TextEncoder().encode(p).length <= 72, "Password is too long"),
});

export const favoriteSchema = z.object({ shopId: objectIdSchema });
