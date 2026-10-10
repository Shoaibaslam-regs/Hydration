// The order travels in the checkout URL (?shop=slug&cans=3) so it survives the
// login redirect without client storage. Safe for client code.
import { MAX_CANS_PER_ORDER } from "@/lib/catalog";

/** Lenient parse of the `cans` param: anything invalid becomes 1, and it's clamped to 1–MAX_CANS_PER_ORDER. */
export function parseCans(raw: string | null | undefined): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 1;
  return Math.min(MAX_CANS_PER_ORDER, n);
}
