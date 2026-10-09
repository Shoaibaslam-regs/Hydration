import { describe, expect, it } from "vitest";
import { slugify } from "./my-shop";

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Blue Spring Water")).toBe("blue-spring-water");
    expect(slugify("  Café   Pure-Flow!! ")).toBe("cafe-pure-flow");
    expect(slugify("💧💧")).toBe("shop");
  });
});
