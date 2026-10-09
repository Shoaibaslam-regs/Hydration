import "server-only";
import mongoose from "mongoose";
import { env } from "@/lib/env";

// Reuse one connection across hot reloads in dev and across invocations in prod.
const globalForMongoose = globalThis as unknown as {
  mongoosePromise?: Promise<typeof mongoose>;
};

export function connectDB(): Promise<typeof mongoose> {
  if (!globalForMongoose.mongoosePromise) {
    globalForMongoose.mongoosePromise = mongoose
      .connect(env().MONGODB_URI, {
        // Indexes are created by `npm run db:indexes`, not on every cold start.
        autoIndex: false,
        serverSelectionTimeoutMS: 10_000,
      })
      .catch((err) => {
        globalForMongoose.mongoosePromise = undefined;
        throw err;
      });
  }
  return globalForMongoose.mongoosePromise;
}
