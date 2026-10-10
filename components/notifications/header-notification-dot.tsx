"use client";

import { NotificationDot } from "./count-badge";
import { useNotificationCounts } from "./use-notification-counts";

/** Dot on the public header's dashboard link while anything is waiting. */
export function HeaderNotificationDot() {
  const { total } = useNotificationCounts();
  if (total === 0) return null;
  return <NotificationDot label={`${total} new`} className="absolute -right-1 -top-1" />;
}
