import { describe, expect, it } from "vitest";
import { distanceKm } from "./geo";

describe("distanceKm", () => {
  it("is zero for the same point", () => {
    expect(distanceKm({ lat: 31.52, lng: 74.35 }, { lat: 31.52, lng: 74.35 })).toBe(0);
  });

  it("matches known distances", () => {
    // One degree of latitude ≈ 111.2 km.
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.2, 0);
    // Lahore → Islamabad ≈ 270 km.
    expect(distanceKm({ lat: 31.5204, lng: 74.3587 }, { lat: 33.6844, lng: 73.0479 })).toBeGreaterThan(260);
    expect(distanceKm({ lat: 31.5204, lng: 74.3587 }, { lat: 33.6844, lng: 73.0479 })).toBeLessThan(280);
  });

  it("is symmetric", () => {
    const a = { lat: 10, lng: 20 };
    const b = { lat: -5, lng: 40 };
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 9);
  });
});
