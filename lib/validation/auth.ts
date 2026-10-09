import { z } from "zod";
import { SELF_SERVICE_ROLES } from "@/lib/auth/roles";

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254));

// bcrypt only uses the first 72 bytes of a password.
const newPassword = z
  .string()
  .min(8, "Use at least 8 characters")
  .refine((p) => new TextEncoder().encode(p).length <= 72, "Password is too long");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email,
  phone: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z
      .string()
      .trim()
      .regex(/^\+?[0-9][0-9\s-]{6,19}$/, "Enter a valid phone number")
      .optional(),
  ),
  password: newPassword,
  role: z.enum(SELF_SERVICE_ROLES).default("customer"),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
