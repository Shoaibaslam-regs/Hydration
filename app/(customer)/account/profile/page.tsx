import type { Metadata } from "next";
import { Suspense } from "react";
import { PasswordForm, ProfileForm } from "@/components/customer/profile-forms";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { DeleteAccount } from "@/components/account/delete-account";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { IdChip } from "@/components/ui/id-chip";
import { requireRole } from "@/lib/auth/session";
import { getProfile } from "@/lib/services/users";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProfileContent />
    </Suspense>
  );
}

async function ProfileContent() {
  const user = await requireRole(["customer"], "/account/profile");
  const profile = await getProfile(user.id);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Profile</h1>
      <Card className="flex flex-col gap-4">
        <div>
          <CardTitle>Your details</CardTitle>
          <CardDescription>Signed in as {profile?.email}</CardDescription>
          {profile?.publicId && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              Your Aqua ID <IdChip id={profile.publicId} />
              <span className="text-xs text-muted-foreground">Mention it if you contact a shop or the Aqua team.</span>
            </p>
          )}
        </div>
        <ProfileForm name={profile?.name ?? ""} phone={profile?.phone ?? ""} />
      </Card>
      <Card className="flex flex-col gap-4">
        <CardTitle>Change password</CardTitle>
        <PasswordForm />
      </Card>
      <DeleteAccount role="customer" />
    </div>
  );
}
