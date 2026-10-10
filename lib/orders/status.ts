// Order lifecycle shared by server and client code.

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "out_for_delivery",
  "delivered",
  "rejected",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "New",
  confirmed: "Confirmed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_TONES: Record<OrderStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  pending: "warning",
  confirmed: "info",
  out_for_delivery: "info",
  delivered: "success",
  rejected: "danger",
  cancelled: "neutral",
};

/** Statuses after which the order can no longer change. */
export const FINAL_ORDER_STATUSES: readonly OrderStatus[] = ["delivered", "rejected", "cancelled"];

/** Moves a shopkeeper may make from each status. */
export const SHOPKEEPER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "rejected"],
  confirmed: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  rejected: [],
  cancelled: [],
};

/** Moves a customer may make: they can cancel only before the shop accepts. */
export const CUSTOMER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["cancelled"],
  confirmed: [],
  out_for_delivery: [],
  delivered: [],
  rejected: [],
  cancelled: [],
};

export function canCustomerMove(from: OrderStatus, to: OrderStatus): boolean {
  return CUSTOMER_TRANSITIONS[from].includes(to);
}

/** Customers can review an order once it's delivered. */
export const REVIEWABLE_STATUS: OrderStatus = "delivered";

/** Statuses that need a reason shown to the customer. */
export const REASON_REQUIRED: readonly OrderStatus[] = ["rejected", "cancelled"];

export function canShopkeeperMove(from: OrderStatus, to: OrderStatus): boolean {
  return SHOPKEEPER_TRANSITIONS[from].includes(to);
}

export const SHOPKEEPER_ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  confirmed: "Accept order",
  rejected: "Reject",
  out_for_delivery: "Mark out for delivery",
  delivered: "Mark delivered",
  cancelled: "Cancel order",
};
