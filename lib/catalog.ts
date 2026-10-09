// Catalog constants and formatting shared by server and client code.

/** ISO 4217 code used for every price in the app. Prices are stored as integer minor units. */
export const CURRENCY = "PKR";
/** IANA time zone used to display dates and times. */
export const TIME_ZONE = "Asia/Karachi";
const MINOR_PER_MAJOR = 100;

export const PRODUCT_TYPES = ["bottle", "can", "refill", "dispenser", "other"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  bottle: "Bottled water",
  can: "Water can",
  refill: "Refill",
  dispenser: "Dispenser",
  other: "Other",
};

export const SHOP_SORTS = ["distance", "rating", "price"] as const;
export const DEFAULT_RADIUS_KM = 10;
export const MAX_RADIUS_KM = 50;

export function toMinorUnits(major: number): number {
  return Math.round(major * MINOR_PER_MAJOR);
}

export function fromMinorUnits(minor: number): number {
  return minor / MINOR_PER_MAJOR;
}

/** Products at or below this stock level are flagged as low stock. */
export const LOW_STOCK_THRESHOLD = 5;

const priceFormatter = new Intl.NumberFormat("en", {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function formatPrice(minor: number): string {
  return priceFormatter.format(minor / MINOR_PER_MAJOR);
}

const compactPriceFormatter = new Intl.NumberFormat("en", {
  style: "currency",
  currency: CURRENCY,
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Short form for axes and tiles, e.g. "PKR 12.5K". */
export function formatPriceCompact(minor: number): string {
  return compactPriceFormatter.format(minor / MINOR_PER_MAJOR);
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}
