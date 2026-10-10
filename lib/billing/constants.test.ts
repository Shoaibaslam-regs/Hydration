import { describe, expect, it } from "vitest";
import { addMonths, nextPeriodStart } from "./constants";

describe("addMonths", () => {
  it("adds calendar months and clamps to the month's last day", () => {
    expect(addMonths(new Date("2026-01-15T10:00:00Z"), 1).toISOString()).toBe("2026-02-15T10:00:00.000Z");
    expect(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(addMonths(new Date("2028-01-31T00:00:00Z"), 1).toISOString()).toBe("2028-02-29T00:00:00.000Z");
    expect(addMonths(new Date("2026-11-30T00:00:00Z"), 3).toISOString()).toBe("2027-02-28T00:00:00.000Z");
    expect(addMonths(new Date("2026-03-10T00:00:00Z"), 12).toISOString()).toBe("2027-03-10T00:00:00.000Z");
  });
});

describe("nextPeriodStart", () => {
  const now = new Date("2026-10-10T00:00:00Z");
  it("starts now with no plan or an expired one, and stacks renewals", () => {
    expect(nextPeriodStart(null, now)).toBe(now);
    expect(nextPeriodStart(new Date("2026-09-01T00:00:00Z"), now)).toBe(now);
    const future = new Date("2026-11-01T00:00:00Z");
    expect(nextPeriodStart(future, now)).toBe(future);
  });
});
