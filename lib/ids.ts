// Short public IDs for people and shops ("CU-7K2M9X"), easy to read out on the
// phone or paste into admin search. Separate from database ids. Safe for client code.
import type { UserRole } from "@/lib/auth/roles";

/** No 0/O/1/I, so IDs survive being read aloud or copied by hand (same as order numbers). */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LENGTH = 6;

export const PUBLIC_ID_PREFIX = { customer: "CU", shopkeeper: "SK", admin: "AD", shop: "SH" } as const;
export type PublicIdKind = keyof typeof PUBLIC_ID_PREFIX;

export function generatePublicId(kind: PublicIdKind | UserRole): string {
  const bytes = crypto.getRandomValues(new Uint8Array(LENGTH));
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `${PUBLIC_ID_PREFIX[kind]}-${s}`;
}

/**
 * If a search looks like (part of) a public ID, return a regex that matches it
 * whether or not the hyphen was typed: "sk4f7" and "SK-4F7" both find "SK-4F7HQ2".
 */
export function publicIdSearchRegex(query: string): RegExp | null {
  const m = query.trim().toUpperCase().match(/^(CU|SK|AD|SH)-?([A-Z0-9]{1,6})$/);
  return m ? new RegExp(`^${m[1]}-${m[2]}`) : null;
}

const LABELS: Record<string, string> = { CU: "Customer ID", SK: "Shopkeeper ID", AD: "Admin ID", SH: "Shop ID" };

/** What an ID belongs to, from its prefix: "SK-4F7HQ2" → "Shopkeeper ID". */
export function publicIdLabel(id: string): string {
  return LABELS[id.slice(0, 2)] ?? "ID";
}
