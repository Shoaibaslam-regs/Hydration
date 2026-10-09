"use client";

import { RouteError } from "@/components/layout/route-error";

export default function Error(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError {...props} homeHref="/admin" />;
}
