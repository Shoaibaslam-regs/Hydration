import { connection } from "next/server";
import mongoose from "mongoose";
import { apiHandler, json } from "@/lib/api/handler";
import { connectDB } from "@/lib/db/connect";

export const GET = apiHandler(async () => {
  await connection();
  try {
    await connectDB();
    await mongoose.connection.db?.admin().ping();
    return json({ status: "ok", db: "up" });
  } catch (err) {
    console.error("Health check: database unreachable", err);
    return json({ status: "degraded", db: "down" }, 503);
  }
});
