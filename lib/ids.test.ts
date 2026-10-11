import { describe, expect, it } from "vitest";
import { generatePublicId, publicIdLabel, publicIdSearchRegex } from "./ids";

describe("public ids", () => {
  it("uses the kind's prefix and a readable alphabet", () => {
    for (let i = 0; i < 200; i++) {
      expect(generatePublicId("customer")).toMatch(/^CU-[A-HJ-NP-Z2-9]{6}$/);
    }
    expect(generatePublicId("shopkeeper")).toMatch(/^SK-/);
    expect(generatePublicId("shop")).toMatch(/^SH-/);
  });

  it("recognises full or partial ids in search, with or without the hyphen", () => {
    expect(publicIdSearchRegex("sk4f7")!.test("SK-4F7HQ2")).toBe(true);
    expect(publicIdSearchRegex(" CU-7K2M9X ")!.test("CU-7K2M9X")).toBe(true);
    expect(publicIdSearchRegex("Blue Spring")).toBeNull();
    expect(publicIdSearchRegex("XX-123")).toBeNull();
  });

  it("names what an ID belongs to", () => {
    expect(publicIdLabel("CU-7K2M9X")).toBe("Customer ID");
    expect(publicIdLabel("SK-4F7HQ2")).toBe("Shopkeeper ID");
    expect(publicIdLabel("AD-SWHCG5")).toBe("Admin ID");
    expect(publicIdLabel("SH-JCWDFN")).toBe("Shop ID");
  });
});
