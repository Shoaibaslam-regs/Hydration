import "server-only";
import { ApiError } from "@/lib/api/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { UserRole } from "@/lib/auth/roles";
import { isSuspended } from "@/lib/auth/suspension";
import { formatDateTime } from "@/lib/catalog";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models";
import type { LoginInput, RegisterInput } from "@/lib/validation/auth";

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  sessionVersion: number;
};

const DUPLICATE_KEY = 11000;

export async function registerUser(
  input: Omit<RegisterInput, "role"> & { role: UserRole },
): Promise<AuthenticatedUser> {
  await connectDB();
  const passwordHash = await hashPassword(input.password);
  for (let attempt = 0; ; attempt++) {
    try {
      const user = await User.create({ name: input.name, email: input.email, phone: input.phone, role: input.role, passwordHash });
      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role as UserRole,
        sessionVersion: user.sessionVersion,
      };
    } catch (err) {
      const e = err as { code?: number; keyPattern?: Record<string, unknown> };
      // A public ID collision (very unlikely): a fresh one is drawn on the next try.
      if (e.code === DUPLICATE_KEY && e.keyPattern?.publicId && attempt < 3) continue;
      if (e.code === DUPLICATE_KEY) throw ApiError.conflict("An account with this email already exists");
      throw err;
    }
  }
}

/** Returns the user for valid credentials, null otherwise. Suspended accounts are rejected with 403. */
export async function authenticate(input: LoginInput): Promise<AuthenticatedUser | null> {
  await connectDB();
  const user = await User.findOne({ email: input.email }).select("+passwordHash").lean();
  const ok = await verifyPassword(input.password, user?.passwordHash);
  if (!user || !ok) return null;
  if (isSuspended(user, new Date())) {
    throw ApiError.forbidden(
      user.suspendedUntil
        ? `This account is suspended until ${formatDateTime(user.suspendedUntil.toISOString())}`
        : "This account has been suspended",
    );
  }
  // A timed suspension that has run out: tidy the record on the next login.
  if (user.status === "suspended") await User.updateOne({ _id: user._id }, { $set: { status: "active", suspendedUntil: null } });

  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    sessionVersion: user.sessionVersion,
  };
}

export async function updateProfile(userId: string, input: { name: string; phone?: string }): Promise<void> {
  await connectDB();
  await User.updateOne(
    { _id: userId },
    input.phone ? { $set: { name: input.name, phone: input.phone } } : { $set: { name: input.name }, $unset: { phone: 1 } },
    { runValidators: true },
  );
}

export async function getProfile(userId: string): Promise<{ name: string; email: string; phone: string; publicId: string } | null> {
  await connectDB();
  const u = await User.findById(userId, { name: 1, email: 1, phone: 1, publicId: 1 }).lean();
  return u ? { name: u.name, email: u.email, phone: u.phone ?? "", publicId: u.publicId ?? "" } : null;
}

/**
 * Change password and revoke all existing sessions by bumping sessionVersion.
 * Returns the user so the caller can issue a fresh session for this device.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<AuthenticatedUser> {
  await connectDB();
  const user = await User.findById(userId).select("+passwordHash").lean();
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw ApiError.badRequest("Current password is incorrect", { fieldErrors: { currentPassword: ["Incorrect password"] } });
  }
  const updated = await User.findByIdAndUpdate(
    userId,
    { $set: { passwordHash: await hashPassword(newPassword) }, $inc: { sessionVersion: 1 } },
    { new: true },
  ).lean();
  return {
    id: updated!._id.toString(),
    name: updated!.name,
    email: updated!.email,
    role: updated!.role as UserRole,
    sessionVersion: updated!.sessionVersion,
  };
}
