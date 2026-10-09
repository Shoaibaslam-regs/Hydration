// Admin rules for shop verification. Safe for client code.

export type ShopStatus = "pending" | "verified" | "rejected" | "suspended";

export const SHOP_STATUS_LABELS: Record<ShopStatus, string> = {
  pending: "Awaiting review",
  verified: "Verified",
  rejected: "Rejected",
  suspended: "Suspended",
};

export const SHOP_STATUS_TONES: Record<ShopStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  pending: "warning",
  verified: "success",
  rejected: "danger",
  suspended: "danger",
};

/** Status changes an admin may make. */
export const ADMIN_SHOP_TRANSITIONS: Record<ShopStatus, readonly ShopStatus[]> = {
  pending: ["verified", "rejected"],
  verified: ["suspended"],
  rejected: ["verified"],
  suspended: ["verified"],
};

/** These are shown to the shopkeeper, so a reason is required. */
export const SHOP_REASON_REQUIRED: readonly ShopStatus[] = ["rejected", "suspended"];

export const ADMIN_SHOP_ACTION_LABELS: Record<ShopStatus, string> = {
  verified: "Verify",
  rejected: "Reject",
  suspended: "Suspend",
  pending: "Move to review",
};

export function canAdminMoveShop(from: ShopStatus, to: ShopStatus): boolean {
  return ADMIN_SHOP_TRANSITIONS[from].includes(to);
}
