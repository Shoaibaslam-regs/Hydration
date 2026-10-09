import "server-only";
import { z } from "zod";

const schema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  /** Signs session JWTs. Generate with: openssl rand -base64 32 */
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  /** Geocoder for the map search box. Defaults to OpenStreetMap's public Nominatim (light use only). */
  GEOCODER_URL: z.url().default("https://nominatim.openstreetmap.org"),
  /** Contact email sent in the geocoder User-Agent, as Nominatim's usage policy asks. */
  GEOCODER_CONTACT_EMAIL: z.email().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated server-side environment. Throws on first access if misconfigured. */
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`);
    }
    cached = parsed.data;
  }
  return cached;
}
