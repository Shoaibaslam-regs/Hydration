// Support conversations between shopkeepers and the Aqua team. Safe for client code.

export const SUPPORT_CATEGORIES = ["billing", "ads", "orders", "account", "shop", "other"] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  billing: "Plan & payments",
  ads: "Ads & promotion",
  orders: "Orders & customers",
  account: "Login & account",
  shop: "Shop listing & approval",
  other: "Something else",
};

export const SUPPORT_STATUSES = ["open", "closed"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

/** Long conversations get unwieldy; past this the shopkeeper starts a new one. */
export const MAX_SUPPORT_MESSAGES = 200;
export const MAX_SUPPORT_MESSAGE_LENGTH = 2000;
