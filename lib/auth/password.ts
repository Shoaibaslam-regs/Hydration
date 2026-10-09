import "server-only";
import bcrypt from "bcryptjs";

const COST = 12;

// A valid hash to compare against when the user doesn't exist, so a login
// for an unknown email takes as long as one with a wrong password.
let dummyHash: Promise<string> | undefined;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string | undefined): Promise<boolean> {
  if (hash) return bcrypt.compare(password, hash);
  dummyHash ??= bcrypt.hash("dummy-password-for-timing", COST);
  await bcrypt.compare(password, await dummyHash);
  return false;
}
