import { describe, expect, it } from "vitest";
import { MAX_CANS_PER_ORDER } from "@/lib/catalog";
import { parseCans } from "./cart";

describe("parseCans", () => {
  it("reads a whole number of cans", () => {
    expect(parseCans("3")).toBe(3);
  });

  it("falls back to 1 for missing or bad input", () => {
    for (const raw of [null, undefined, "", "0", "-2", "1.5", "abc"]) expect(parseCans(raw)).toBe(1);
  });

  it("caps very large orders", () => {
    expect(parseCans("100000")).toBe(MAX_CANS_PER_ORDER);
  });
});
