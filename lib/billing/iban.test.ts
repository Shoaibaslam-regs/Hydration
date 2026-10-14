import { describe, expect, it } from "vitest";
import { formatIban, isValidIban, normalizeIban } from "./iban";

describe("IBAN", () => {
  it("accepts valid IBANs however they're typed", () => {
    expect(isValidIban("PK36SCBL0000001123456702")).toBe(true);
    expect(isValidIban("pk36 scbl 0000 0011 2345 6702")).toBe(true);
    expect(isValidIban("GB82 WEST 1234 5698 7654 32")).toBe(true);
  });

  it("rejects wrong check digits, lengths and shapes", () => {
    expect(isValidIban("PK37SCBL0000001123456702")).toBe(false); // check digits off by one
    expect(isValidIban("PK36SCBL000000112345670")).toBe(false); // PK must be 24 characters
    expect(isValidIban("1234567890")).toBe(false);
    expect(isValidIban("")).toBe(false);
  });

  it("normalizes and groups by four", () => {
    expect(normalizeIban(" pk36-scbl 0000 ")).toBe("PK36SCBL0000");
    expect(formatIban("PK36SCBL0000001123456702")).toBe("PK36 SCBL 0000 0011 2345 6702");
  });
});
