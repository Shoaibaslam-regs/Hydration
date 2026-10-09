// Creates/updates indexes for all registered models. Run: npm run db:indexes
import mongoose from "mongoose";
import { models } from "../lib/db/models";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  await mongoose.connect(uri);
  for (const model of models) {
    const dropped = await model.syncIndexes();
    console.log(`${model.modelName}: synced${dropped.length ? `, dropped ${dropped.join(", ")}` : ""}`);
  }
  console.log(`Done (${models.length} models).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
