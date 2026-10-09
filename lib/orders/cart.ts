// The cart travels in the checkout URL (?items=productId:qty,…) so it
// survives the login redirect without client storage. Safe for client code.

export const MAX_CART_LINES = 20;
export const MAX_LINE_QUANTITY = 99;

export type CartLine = { productId: string; quantity: number };

export function encodeCart(lines: CartLine[]): string {
  return lines
    .filter((l) => l.quantity > 0)
    .map((l) => `${l.productId}:${l.quantity}`)
    .join(",");
}

/** Lenient parse: drops malformed entries, merges duplicates, clamps quantities. */
export function decodeCart(raw: string | null | undefined): CartLine[] {
  if (!raw) return [];
  const merged = new Map<string, number>();
  for (const part of raw.split(",").slice(0, MAX_CART_LINES * 2)) {
    const [id, qty] = part.split(":");
    const quantity = Number(qty);
    if (!/^[a-f0-9]{24}$/i.test(id ?? "") || !Number.isInteger(quantity) || quantity < 1) continue;
    merged.set(id.toLowerCase(), Math.min(MAX_LINE_QUANTITY, (merged.get(id.toLowerCase()) ?? 0) + quantity));
  }
  return [...merged].slice(0, MAX_CART_LINES).map(([productId, quantity]) => ({ productId, quantity }));
}
