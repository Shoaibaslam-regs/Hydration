import { describe, expect, it } from "vitest";
import { decodeCart, encodeCart, MAX_LINE_QUANTITY } from "./cart";

const A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const B = "bbbbbbbbbbbbbbbbbbbbbbbb";

describe("cart encoding", () => {
  it("round-trips and skips zero quantities", () => {
    const encoded = encodeCart([
      { productId: A, quantity: 2 },
      { productId: B, quantity: 0 },
    ]);
    expect(encoded).toBe(`${A}:2`);
    expect(decodeCart(encoded)).toEqual([{ productId: A, quantity: 2 }]);
  });

  it("drops malformed entries and merges duplicates", () => {
    expect(decodeCart(`${A}:1,garbage,${B}:x,${A}:2,${B}:-1,:3`)).toEqual([{ productId: A, quantity: 3 }]);
  });

  it("clamps quantities", () => {
    expect(decodeCart(`${A}:5000`)).toEqual([{ productId: A, quantity: MAX_LINE_QUANTITY }]);
  });

  it("handles empty input", () => {
    expect(decodeCart(null)).toEqual([]);
    expect(decodeCart("")).toEqual([]);
  });
});
