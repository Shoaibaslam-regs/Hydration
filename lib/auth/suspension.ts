// Account suspension rules. Safe for client code.

/** Suspension lengths an admin can choose; null = until an admin lifts it. */
export const SUSPENSION_DAYS = [1, 3, 7, 14, 30, 90] as const;
export type SuspensionDays = (typeof SUSPENSION_DAYS)[number];

/**
 * A user is suspended while their status says so and the end date (if any)
 * hasn't passed. Expired suspensions lift themselves; no background job needed.
 */
export function isSuspended(user: { status?: string | null; suspendedUntil?: Date | null }, now: Date): boolean {
  return user.status === "suspended" && (!user.suspendedUntil || user.suspendedUntil > now);
}

/** MongoDB filter for accounts that are currently suspended (see isSuspended). */
export function suspendedFilter(now: Date) {
  return { status: "suspended", $or: [{ suspendedUntil: null }, { suspendedUntil: { $gt: now } }] };
}
