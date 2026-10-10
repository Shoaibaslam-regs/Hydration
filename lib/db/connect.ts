import "server-only";
import type mongoose from "mongoose";
import { env } from "@/lib/env";
import { connectWithUri } from "./connect-core";

/** The app's MongoDB connection (opened once, then reused). Also warmed at startup by instrumentation.ts. */
export function connectDB(): Promise<typeof mongoose> {
  return connectWithUri(env().MONGODB_URI);
}
