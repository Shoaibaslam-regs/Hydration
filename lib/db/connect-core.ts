// The shared Mongo connection, without the "server-only" marker so that
// instrumentation.ts (which runs outside the React Server bundle) can open it
// at startup. App code imports `connectDB` from ./connect instead.
import mongoose from "mongoose";

// Reuse one connection across hot reloads in dev and across requests in prod.
// Keyed on globalThis, so the startup warm-up and app code share it.
const globalForMongoose = globalThis as unknown as {
  mongoosePromise?: Promise<typeof mongoose>;
};

const OPTIONS: mongoose.ConnectOptions = {
  // Indexes are created by `npm run db:indexes`, not on every cold start.
  autoIndex: false,
  serverSelectionTimeoutMS: 10_000,
  // Some networks advertise IPv6 but can't route it; trying it first can add
  // seconds to every new connection to Atlas. IPv4 is always fine.
  family: 4,
  // Keep a couple of sockets open so requests don't wait for a new TLS
  // handshake (~0.7 s to Atlas) after a quiet period.
  minPoolSize: 2,
  maxPoolSize: 20,
};

/**
 * DNS answers that fail fast (a router briefly returning SERVFAIL) are worth
 * retrying at once. Timeouts aren't: each one already took many seconds.
 */
function isTransientDnsError(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? "";
  return ["ESERVFAIL", "EAI_AGAIN", "ECONNREFUSED"].includes(code);
}

async function connectWithRetry(uri: string): Promise<typeof mongoose> {
  const delays = [300, 1_000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await mongoose.connect(uri, OPTIONS);
    } catch (err) {
      if (attempt >= delays.length || !isTransientDnsError(err)) throw err;
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
}

export function connectWithUri(uri: string): Promise<typeof mongoose> {
  if (!globalForMongoose.mongoosePromise) {
    globalForMongoose.mongoosePromise = connectWithRetry(uri).catch((err) => {
      globalForMongoose.mongoosePromise = undefined;
      throw err;
    });
  }
  return globalForMongoose.mongoosePromise;
}

/**
 * Open the connection in the background at startup, retrying with backoff for
 * about a minute, so the first visitor finds it ready. Never throws.
 */
export function warmUp(uri: string): void {
  const backoff = [2_000, 5_000, 10_000, 20_000, 30_000];
  const attempt = (i: number) => {
    connectWithUri(uri).catch((err) => {
      if (i >= backoff.length) {
        console.error("Database warm-up gave up; requests will connect on demand:", err instanceof Error ? err.message : err);
        return;
      }
      setTimeout(() => attempt(i + 1), backoff[i]).unref();
    });
  };
  attempt(0);
}
