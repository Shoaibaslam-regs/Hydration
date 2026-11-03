// Failed login / registration attempts allowed per IP before a lock. Safe for client code.

export const AUTH_MAX_FAILURES = 3;
export const AUTH_LOCK_MINUTES = 15;

export const AUTH_LOCKED_MESSAGE = `Too many failed attempts from your network. Please wait ${AUTH_LOCK_MINUTES} minutes and try again.`;

/** "2 tries left before a 15-minute wait." */
export function attemptsLeftNote(attemptsLeft: number): string {
  return `${attemptsLeft} ${attemptsLeft === 1 ? "try" : "tries"} left before a ${AUTH_LOCK_MINUTES}-minute wait.`;
}
