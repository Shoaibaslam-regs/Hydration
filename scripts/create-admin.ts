// Creates an admin account with a generated password (printed once).
// Usage: npm run user:create-admin -- --email admin@example.com --name "Site Admin"
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { registerUser } from "../lib/services/users";
import { registerSchema } from "../lib/validation/auth";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const password = randomBytes(18).toString("base64url");
  const input = registerSchema.parse({ email: arg("email"), name: arg("name") ?? "Admin", password });
  const user = await registerUser({ ...input, role: "admin" });
  console.log(`Admin created: ${user.email}`);
  console.log(`Password (shown once, store it safely): ${password}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
