// Support conversations between customers/shopkeepers and the Aqua team. Safe for client code.

export const SUPPORT_CATEGORIES = ["billing", "ads", "orders", "complaint", "account", "shop", "other", "aqua"] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  billing: "Plan & payments",
  ads: "Ads & promotion",
  orders: "Orders & delivery",
  complaint: "Complaint about a shop",
  account: "Login & account",
  shop: "Shop listing & approval",
  other: "Something else",
  /** Conversations the team starts (never offered in the users' form). */
  aqua: "Message from Aqua",
};

/** Topics offered in the form, by who is writing. */
export const SUPPORT_CATEGORIES_FOR = {
  shopkeeper: ["billing", "ads", "orders", "account", "shop", "other"],
  customer: ["orders", "complaint", "account", "other"],
} as const satisfies Record<"shopkeeper" | "customer", readonly SupportCategory[]>;

export const SUPPORT_STATUSES = ["open", "closed"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

/** Roles that can start a conversation with the team. */
export const SUPPORT_USER_ROLES = ["customer", "shopkeeper"] as const;
export type SupportUserRole = (typeof SUPPORT_USER_ROLES)[number];

/** Where each role's support pages live. */
export const SUPPORT_PATH: Record<SupportUserRole, string> = { customer: "/account/support", shopkeeper: "/shop/support" };

/** Long conversations get unwieldy; past this the user starts a new one. */
export const MAX_SUPPORT_MESSAGES = 200;
export const MAX_SUPPORT_MESSAGE_LENGTH = 2000;
