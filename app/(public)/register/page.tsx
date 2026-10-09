import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard, FormSkeleton } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create an account" };

export default function RegisterPage() {
  return (
    <AuthCard title="Create your account" subtitle="Order water from nearby shops, or list your own shop.">
      {/* RegisterForm reads ?role= and ?next= from the URL. */}
      <Suspense fallback={<FormSkeleton fields={5} />}>
        <RegisterForm />
      </Suspense>
    </AuthCard>
  );
}
