"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";

type Errors = Record<string, string[] | undefined>;

export type BannerFormValues = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  sponsorName: string;
  linkUrl: string;
  imageId: string | null;
  videoId: string | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  sortOrder: number;
};

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_VIDEO_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 30;

/** A clip's length in seconds, read in the browser before uploading. */
function videoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(v.duration);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(Number.NaN);
    };
    v.src = url;
  });
}

/**
 * Create or edit a home-page banner. The image and the optional short video
 * upload first (multipart), then the banner saves with their ids.
 */
export function BannerEditor({ bannerId, initial }: { bannerId?: string; initial: BannerFormValues }) {
  const router = useRouter();
  const [imageId, setImageId] = useState(initial.imageId);
  const [videoId, setVideoId] = useState(initial.videoId);
  const [uploading, setUploading] = useState<"imageId" | "videoId" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Errors>({});

  async function upload(kind: "imageId" | "videoId", file: File | undefined) {
    if (!file) return;
    setError(null);
    const fail = (message: string) => setFieldErrors({ [kind]: [message] });
    if (kind === "imageId" && file.size > MAX_IMAGE_BYTES) return fail("The image must be 2 MB or smaller");
    if (kind === "videoId") {
      if (file.size > MAX_VIDEO_BYTES) return fail("The video must be 8 MB or smaller");
      const seconds = await videoDuration(file);
      if (Number.isNaN(seconds)) return fail("This browser can't read that video. Use an MP4 or WebM file.");
      if (seconds > MAX_VIDEO_SECONDS + 0.5) return fail(`Keep it short: ${MAX_VIDEO_SECONDS} seconds or less (this one is ${Math.round(seconds)} s)`);
    }
    setUploading(kind);
    const form = new FormData();
    form.set("file", file);
    try {
      const res = await fetch(kind === "imageId" ? "/api/admin/banner-images" : "/api/admin/banner-videos", { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) fail(body?.error?.message ?? "Upload failed");
      else {
        (kind === "imageId" ? setImageId : setVideoId)(body.id);
        setFieldErrors({});
      }
    } catch {
      fail("Network error. Try again.");
    }
    setUploading(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const body = {
      title: f.get("title"),
      subtitle: f.get("subtitle"),
      ctaLabel: f.get("ctaLabel") || "Learn more",
      sponsorName: f.get("sponsorName") ?? "",
      linkUrl: f.get("linkUrl"),
      imageId,
      videoId,
      startDate: f.get("startDate"),
      endDate: f.get("endDate"),
      isActive: f.get("isActive") === "on",
      sortOrder: Number(f.get("sortOrder") || 0),
    };
    const result = bannerId
      ? await apiRequest(`/api/admin/banners/${bannerId}`, { method: "PUT", body })
      : await apiRequest("/api/admin/banners", { body });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      setFieldErrors(result.fieldErrors);
      return;
    }
    router.push("/admin/ads?tab=banners");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormError message={error} />
      <Field label="Title" error={fieldErrors.title?.[0]}>
        {(p) => <Input {...p} name="title" defaultValue={initial.title} maxLength={80} required />}
      </Field>
      <Field
        label="Advertiser (optional)"
        hint="Shown on the banner as “Sponsored by …”. Leave empty for Aqua's own announcements."
        error={fieldErrors.sponsorName?.[0]}
      >
        {(p) => <Input {...p} name="sponsorName" defaultValue={initial.sponsorName} maxLength={60} placeholder="e.g. Nestlé Pure Life" />}
      </Field>
      <Field label="Subtitle (optional)" error={fieldErrors.subtitle?.[0]}>
        {(p) => <Input {...p} name="subtitle" defaultValue={initial.subtitle} maxLength={160} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <Field label="Button text" error={fieldErrors.ctaLabel?.[0]}>
          {(p) => <Input {...p} name="ctaLabel" defaultValue={initial.ctaLabel} maxLength={30} />}
        </Field>
        <Field label="Link" hint="A page on this site (/shops?deals=1) or a full https:// address." error={fieldErrors.linkUrl?.[0]}>
          {(p) => <Input {...p} name="linkUrl" defaultValue={initial.linkUrl} maxLength={500} required />}
        </Field>
      </div>

      <Field label="Image (optional)" hint="PNG, JPEG or WebP, up to 2 MB. Wide images (about 3:1) look best." error={fieldErrors.imageId?.[0]}>
        {(p) => (
          <div className="flex flex-col gap-2">
            {imageId && (
              // eslint-disable-next-line @next/next/no-img-element -- uploaded at runtime, served by our API
              <img src={`/api/banner-images/${imageId}`} alt="" className="aspect-[3/1] w-full max-w-md rounded-lg border border-border object-cover" />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                {...p}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => upload("imageId", e.target.files?.[0])}
                disabled={uploading !== null}
                className="max-w-xs"
              />
              {uploading === "imageId" && <span className="text-sm text-muted-foreground">Uploading…</span>}
              {imageId && uploading !== "imageId" && (
                <Button type="button" variant="ghost" onClick={() => setImageId(null)}>
                  Remove image
                </Button>
              )}
            </div>
          </div>
        )}
      </Field>

      <Field
        label="Short video (optional)"
        hint={`MP4 or WebM, up to ${MAX_VIDEO_SECONDS} seconds and 8 MB. It plays silently on a loop in the banner (visitors can turn the sound on); the image above shows while it loads.`}
        error={fieldErrors.videoId?.[0]}
      >
        {(p) => (
          <div className="flex flex-col gap-2">
            {videoId && (
              <video
                src={`/api/banner-videos/${videoId}`}
                poster={imageId ? `/api/banner-images/${imageId}` : undefined}
                controls
                muted
                playsInline
                preload="metadata"
                className="aspect-[3/1] w-full max-w-md rounded-lg border border-border bg-black object-cover"
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                {...p}
                type="file"
                accept="video/mp4,video/webm"
                onChange={(e) => upload("videoId", e.target.files?.[0])}
                disabled={uploading !== null}
                className="max-w-xs"
              />
              {uploading === "videoId" && <span className="text-sm text-muted-foreground">Uploading video…</span>}
              {videoId && uploading !== "videoId" && (
                <Button type="button" variant="ghost" onClick={() => setVideoId(null)}>
                  Remove video
                </Button>
              )}
            </div>
          </div>
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="First day" error={fieldErrors.startDate?.[0]}>
          {(p) => <Input {...p} name="startDate" type="date" defaultValue={initial.startDate} required />}
        </Field>
        <Field label="Last day" error={fieldErrors.endDate?.[0]}>
          {(p) => <Input {...p} name="endDate" type="date" defaultValue={initial.endDate} required />}
        </Field>
        <Field label="Order" hint="Lower shows first." error={fieldErrors.sortOrder?.[0]}>
          {(p) => <Input {...p} name="sortOrder" type="number" min={0} max={100} defaultValue={initial.sortOrder} />}
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={initial.isActive} className="size-4 accent-[var(--primary)]" />
        Show this banner (untick to pause it)
      </label>
      <Button type="submit" disabled={pending || uploading !== null} className="self-start">
        {pending ? "Saving…" : bannerId ? "Save banner" : "Create banner"}
      </Button>
    </form>
  );
}
