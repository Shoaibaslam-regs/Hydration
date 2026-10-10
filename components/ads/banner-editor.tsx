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
  linkUrl: string;
  imageId: string | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  sortOrder: number;
};

const MAX_BYTES = 2 * 1024 * 1024;

/** Create or edit a home-page banner. Images upload first (multipart), then the banner saves with the image's id. */
export function BannerEditor({ bannerId, initial }: { bannerId?: string; initial: BannerFormValues }) {
  const router = useRouter();
  const [imageId, setImageId] = useState(initial.imageId);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Errors>({});

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) {
      setFieldErrors({ imageId: ["The image must be 2 MB or smaller"] });
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.set("file", file);
    try {
      const res = await fetch("/api/admin/banner-images", { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) setFieldErrors({ imageId: [body?.error?.message ?? "Upload failed"] });
      else {
        setImageId(body.id);
        setFieldErrors({});
      }
    } catch {
      setFieldErrors({ imageId: ["Network error. Try again."] });
    }
    setUploading(false);
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
      linkUrl: f.get("linkUrl"),
      imageId,
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
                onChange={(e) => upload(e.target.files?.[0])}
                disabled={uploading}
                className="max-w-xs"
              />
              {uploading && <span className="text-sm text-muted-foreground">Uploading…</span>}
              {imageId && !uploading && (
                <Button type="button" variant="ghost" onClick={() => setImageId(null)}>
                  Remove image
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
      <Button type="submit" disabled={pending || uploading} className="self-start">
        {pending ? "Saving…" : bannerId ? "Save banner" : "Create banner"}
      </Button>
    </form>
  );
}
