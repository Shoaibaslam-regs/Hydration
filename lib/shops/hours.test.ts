import { describe, expect, it } from "vitest";
import { isOpenAt, minutesInZone } from "./hours";

// Asia/Karachi is UTC+5 all year.
const at = (hhmmKarachi: string) => {
  const [h, m] = hhmmKarachi.split(":").map(Number);
  return new Date(Date.UTC(2026, 9, 11, (h - 5 + 24) % 24, m));
};

describe("opening hours", () => {
  it("reads the time in the app time zone", () => {
    expect(minutesInZone(at("09:30"))).toBe(9 * 60 + 30);
  });

  it("handles normal day hours", () => {
    const hours = { opensAt: "08:00", closesAt: "22:00" };
    expect(isOpenAt(hours, at("07:59"))).toBe(false);
    expect(isOpenAt(hours, at("08:00"))).toBe(true);
    expect(isOpenAt(hours, at("21:59"))).toBe(true);
    expect(isOpenAt(hours, at("22:00"))).toBe(false);
  });

  it("handles hours past midnight", () => {
    const hours = { opensAt: "18:00", closesAt: "02:00" };
    expect(isOpenAt(hours, at("23:00"))).toBe(true);
    expect(isOpenAt(hours, at("01:30"))).toBe(true);
    expect(isOpenAt(hours, at("12:00"))).toBe(false);
  });
});
