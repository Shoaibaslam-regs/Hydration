import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// CSP without nonces: nonces force every page to render dynamically, which
// conflicts with the Partial Prerendering this app relies on (see the bundled
// docs, 02-guides/content-security-policy.md). Map tiles come from
// OpenStreetMap; update img-src if the map provider changes.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://*.tile.openstreetmap.org",
  "font-src 'self'",
  // Banner videos; blob: lets the admin form read a clip's length before uploading.
  "media-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // No upgrade-insecure-requests: every asset is same-origin, HSTS already forces
  // HTTPS on the real site, and the directive breaks plain-HTTP LAN testing.
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolocation is used for "use my location"; nothing else needs device access.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

// Let phones/tablets on the same network use the dev server (e.g. http://192.168.1.20:3000).
// Next blocks dev-only resources (like live reload) from other hosts by default.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a!.address);

const nextConfig: NextConfig = {
  // Plus HTTPS tunnels, the easiest way to test "use my location" on a phone (it needs HTTPS).
  allowedDevOrigins: [...lanAddresses, "*.trycloudflare.com", "*.ngrok-free.app"],
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
