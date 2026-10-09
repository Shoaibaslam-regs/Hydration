import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { connectDB } from "@/lib/db/connect";
import { models } from "@/lib/db/models";

/** Call at the top of an integration test file: real MongoDB, indexes synced, emptied before each test. */
export function setupTestDb() {
  beforeAll(async () => {
    await connectDB();
    await Promise.all(models.map((m) => m.syncIndexes()));
  });
  beforeEach(async () => {
    await Promise.all(models.map((m) => m.deleteMany({})));
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
}
