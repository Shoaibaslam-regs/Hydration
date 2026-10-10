import { describe, expect, it } from "vitest";
import { normalizeSearchText, searchTokens, shopSearchText } from "./text";

describe("search text", () => {
  it("ignores case, hyphens and punctuation", () => {
    expect(normalizeSearchText("Gulshan-e-Bahar, Orangi Town!")).toBe("gulshan e bahar orangi town");
  });

  it("keeps useful words only", () => {
    expect(searchTokens("Orangi Town  gulshan e bahar near Karachi")).toEqual(["orangi", "town", "gulshan", "bahar", "karachi"]);
    expect(searchTokens("street 4 B1")).toEqual(["street", "4", "b1"]);
    expect(searchTokens(" - , ")).toEqual([]);
  });

  it("keeps non-Latin text", () => {
    expect(searchTokens("اورنگی ٹاؤن")).toEqual(["اورنگی", "ٹاؤن"]);
  });

  it("builds a shop's searchable text from its name and address", () => {
    expect(shopSearchText({ name: "Blue Spring", address: { line1: "B1, Street 4", area: "Gulshan-e-Bahar, Orangi Town", city: "Karachi" } })).toBe(
      "blue spring b1 street 4 gulshan e bahar orangi town karachi",
    );
  });
});
