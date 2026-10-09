import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { ApiError } from "@/lib/api/errors";
import { hashPassword } from "@/lib/auth/password";
import type { SessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { PasswordReset, User } from "@/lib/db/models";
import { logAdminAction } from "./admin/audit";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Admin-issued reset link (there's no email provider yet). Replaces any
 * unused link for the user. The raw token is returned once and never stored.
 */
export async function createResetToken(admin: SessionUser, userId: string): Promise<{ token: string; expiresAt: string }> {
  await connectDB();
  if (userId === admin.id) throw ApiError.forbidden("Use your own password change instead");
  const user = await User.findById(userId, { _id: 1 }).lean();
  if (!user) throw ApiError.notFound("User not found");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await PasswordReset.deleteMany({ userId: user._id, usedAt: null });
  await PasswordReset.create({ tokenHash: hashToken(token), userId: user._id, createdBy: new Types.ObjectId(admin.id), expiresAt });
  await logAdminAction(admin, "user.resetLink", "user", user._id);
  return { token, expiresAt: expiresAt.toISOString() };
}

/** Whether a token can still be used (for showing the form or an "expired" message). */
export async function isResetTokenValid(token: string): Promise<boolean> {
  await connectDB();
  return Boolean(await PasswordReset.exists({ tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: new Date() } }));
}

/**
 * Set a new password with a reset token. The token is claimed atomically so it
 * works once, and every existing session is signed out.
 */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  await connectDB();
  const claimed = await PasswordReset.findOneAndUpdate(
    { tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  ).lean();
  if (!claimed) throw ApiError.badRequest("This reset link is invalid or has expired. Ask for a new one.");
  await User.updateOne(
    { _id: claimed.userId },
    { $set: { passwordHash: await hashPassword(newPassword) }, $inc: { sessionVersion: 1 } },
  );
}
