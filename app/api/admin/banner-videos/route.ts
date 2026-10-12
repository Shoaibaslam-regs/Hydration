import { ApiError } from "@/lib/api/errors";
import { apiHandler, json } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { MAX_BANNER_VIDEO_BYTES, saveBannerVideo } from "@/lib/services/ads/banners";

/** POST /api/admin/banner-videos — multipart form with one "file" field (MP4/WebM, ≤ 8 MB). */
export const POST = apiHandler(async (req) => {
  await requireApiUser(["admin"]);
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BANNER_VIDEO_BYTES + 64 * 1024) throw ApiError.payloadTooLarge(MAX_BANNER_VIDEO_BYTES);
  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    throw ApiError.badRequest('Send the video as multipart form data in a field named "file"');
  }
  if (!(file instanceof File)) throw ApiError.badRequest("Choose a video to upload");
  return json({ id: await saveBannerVideo(new Uint8Array(await file.arrayBuffer())) }, 201);
});
