import { afterEach, describe, expect, it, vi } from "vitest";
import { geocode } from "./geocode";

afterEach(() => vi.unstubAllGlobals());

describe("geocode", () => {
  it("asks Nominatim with an identifying User-Agent and maps results", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json([
        { display_name: "Gulberg III, Lahore, Pakistan", lat: "31.515", lon: "74.351" },
        { display_name: "Broken", lat: "x", lon: "y" },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await geocode("gulberg iii")).toEqual([{ title: "Gulberg III", subtitle: "Lahore, Pakistan", lat: 31.515, lng: 74.351 }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/search?q=gulberg+iii&format=jsonv2&limit=5");
    expect(init.headers["User-Agent"]).toMatch(/^Aqua\/1\.0/);
  });

  it("turns network failures and bad responses into a 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    await expect(geocode("x street")).rejects.toMatchObject({ status: 502 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("busy", { status: 503 })));
    await expect(geocode("x street")).rejects.toMatchObject({ status: 502 });
  });
});

describe("toResults", () => {
  it("shortens labels, drops postcodes and merges entries that would look identical", async () => {
    const { toResults } = await import("./geocode");
    const hit = (display_name: string, lat = "31.5154", lon = "74.3420") => ({ display_name, lat, lon });
    expect(
      toResults([
        hit("Liberty Market, Gulberg, Lahore Cantonment, Lahore District, Punjab, 54660, Pakistan"),
        hit("Liberty Market, Gulberg, Lahore Cantonment, Lahore District, Punjab, Pakistan", "31.51541", "74.34201"),
        hit("Main Boulevard, 54000, Garden Town, Lahore", "31.50", "74.33"),
      ]),
    ).toEqual([
      { title: "Liberty Market", subtitle: "Gulberg, Lahore Cantonment", lat: 31.5154, lng: 74.342 },
      { title: "Main Boulevard", subtitle: "Garden Town, Lahore", lat: 31.5, lng: 74.33 },
    ]);
  });
});
