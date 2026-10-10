import { describe, expect, it } from "vitest";
import { dayKey, endOfDayInZone, startOfDayInZone } from "./dates";

// TIME_ZONE is Asia/Karachi (UTC+5, no DST).
describe("ad date helpers", () => {
  it("finds local midnight as a UTC instant", () => {
    expect(startOfDayInZone("2026-10-10").toISOString()).toBe("2026-10-09T19:00:00.000Z");
    expect(endOfDayInZone("2026-10-10").toISOString()).toBe("2026-10-10T19:00:00.000Z");
  });

  it("buckets moments by local day", () => {
    expect(dayKey(new Date("2026-10-09T18:59:59Z"))).toBe("2026-10-09");
    expect(dayKey(new Date("2026-10-09T19:00:00Z"))).toBe("2026-10-10");
  });
});
