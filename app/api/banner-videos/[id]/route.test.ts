import { beforeEach, describe, expect, it, vi } from "vitest";

const video = { contentType: "video/mp4", data: Buffer.from("0123456789") };
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/services/ads/banners", () => ({ getBannerVideo: vi.fn(async (id: string) => (id === "found" ? video : null)) }));

const { GET } = await import("./route");
const call = (id: string, range?: string) =>
  GET(new Request("http://x/api/banner-videos/" + id, { headers: range ? { range } : {} }), { params: Promise.resolve({ id }) } as never);

describe("GET /api/banner-videos/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("serves the whole clip, or 404", async () => {
    const res = await call("found");
    expect(res.status).toBe(200);
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(await res.text()).toBe("0123456789");
    expect((await call("missing")).status).toBe(404);
  });

  it("answers byte ranges (Safari needs them)", async () => {
    const part = await call("found", "bytes=2-5");
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(await part.text()).toBe("2345");
    expect(await (await call("found", "bytes=7-")).text()).toBe("789");
    expect(await (await call("found", "bytes=-3")).text()).toBe("789");
    expect((await call("found", "bytes=20-")).status).toBe(416);
  });
});
