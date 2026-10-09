import { z } from "zod";
import { DEFAULT_RADIUS_KM, MAX_RADIUS_KM, PRODUCT_TYPES, SHOP_SORTS } from "@/lib/catalog";
import { paginationSchema } from "./pagination";

// HTML GET forms submit empty fields as "", which should mean "not set".
const blankToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);
const optional = <T extends z.ZodType>(schema: T) => z.preprocess(blankToUndefined, schema.optional());

export const shopSearchSchema = paginationSchema
  .extend({
    q: optional(z.string().trim().max(100)),
    lat: optional(z.coerce.number().min(-90).max(90)),
    lng: optional(z.coerce.number().min(-180).max(180)),
    radiusKm: z.preprocess(blankToUndefined, z.coerce.number().min(1).max(MAX_RADIUS_KM).default(DEFAULT_RADIUS_KM)),
    type: optional(z.enum(PRODUCT_TYPES)),
    /** Major currency units, as typed by the user. */
    maxPrice: optional(z.coerce.number().positive().max(1_000_000)),
    minRating: optional(z.coerce.number().min(1).max(5)),
    sort: optional(z.enum(SHOP_SORTS)),
  })
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), {
    message: "lat and lng must be provided together",
    path: ["lat"],
  });

export type ShopSearch = z.infer<typeof shopSearchSchema>;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const shopSlugSchema = z.string().max(140).regex(SLUG_PATTERN, "Invalid shop slug");
