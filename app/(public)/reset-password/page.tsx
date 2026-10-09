import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthCard, FormSkeleton } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { isResetTokenValid } from "@/lib/services/password-reset";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <AuthCard title="Choose a new password" subtitle="This link works once and expires an hour after it was created.">
      <Suspense fallback={<FormSkeleton fields={2} />}>
        <ResetContent searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function ResetContent({ searchParams }: { searchParams: PageProps<"/reset-password">["searchParams"] }) {
  const { token } = await searchParams;
  // Token validity depends on the clock and the database: always check per request.
  await connection();
  const valid = typeof token === "string" && token.length >= 20 && token.length <= 200 && (await isResetTokenValid(token));
  if (!valid) {
    return (
      <p className="text-sm text-muted-foreground">
        This reset link is invalid, already used, or expired. Ask the Aqua team for a new one, or{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          go to login
        </Link>
        .
      </p>
    );
  }
  return <ResetPasswordForm token={token} />;
}
