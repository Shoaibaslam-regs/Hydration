/**
 * Runs once when the server starts. Opens the database connection right away
 * (in the background, with retries) so the first visitor doesn't wait for
 * DNS + TLS to Atlas. Not awaited: the server must start even if the database
 * is down; requests then connect on demand through connectDB().
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.MONGODB_URI) return;
  const { warmUp } = await import("./lib/db/connect-core");
  warmUp(process.env.MONGODB_URI);
}
