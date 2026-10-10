import { ApiError } from "@/lib/api/errors";
import { apiHandler, json } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { MAX_BANNER_IMAGE_BYTES, saveBannerImage } from "@/lib/services/ads/banners";

/** POST /api/admin/banner-images — multipart form with one "file" field (PNG/JPEG/WebP, ≤ 2 MB). */
export const POST = apiHandler(async (req) => {
  await requireApiUser(["admin"]);
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BANNER_IMAGE_BYTES + 64 * 1024) throw ApiError.payloadTooLarge(MAX_BANNER_IMAGE_BYTES);
  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    throw ApiError.badRequest('Send the image as multipart form data in a field named "file"');
  }
  if (!(file instanceof File)) throw ApiError.badRequest("Choose an image to upload");
  return json({ id: await saveBannerImage(new Uint8Array(await file.arrayBuffer())) }, 201);
});
