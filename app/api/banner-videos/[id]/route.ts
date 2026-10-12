import { connection } from "next/server";
import { getBannerVideo } from "@/lib/services/ads/banners";

/**
 * GET /api/banner-videos/:id — public. Supports Range requests (Safari and
 * iOS won't play a video without them). Videos never change (a replaced one
 * gets a new id), so cache for a year.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/banner-videos/[id]">) {
  await connection();
  const video = await getBannerVideo((await ctx.params).id);
  if (!video) return new Response("Not found", { status: 404 });
  const size = video.data.length;
  const headers: Record<string, string> = {
    "Content-Type": video.contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (!range) return new Response(new Uint8Array(video.data), { headers: { ...headers, "Content-Length": String(size) } });

  // "bytes=a-b", "bytes=a-" or the last n bytes ("bytes=-n").
  let start = range[1] === "" ? size - Number(range[2]) : Number(range[1]);
  let end = range[1] === "" || range[2] === "" ? size - 1 : Number(range[2]);
  start = Math.max(0, start);
  end = Math.min(end, size - 1);
  if (!Number.isFinite(start) || start > end) {
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
  }
  return new Response(new Uint8Array(video.data.subarray(start, end + 1)), {
    status: 206,
    headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
  });
}
