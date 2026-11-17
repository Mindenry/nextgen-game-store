import { CalendarDays, Mail, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Badge, Card, Separator } from "@/components/ui";
import { ProfileForm } from "@/components/profile-form";
import { ROLE_LABELS, type RoleId } from "@/lib/auth/rbac";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser("/dashboard/profile");
  const row = await one<{ created_at: string; email_verified_at: string | null }>(
    "select created_at, email_verified_at from profiles where id = $1",
    [user.id],
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Account</p>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">My profile</h1>
        <p className="mt-1 text-sm text-muted">Update how your name and contact details appear on orders.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Profile details</h2>
          <ProfileForm
            displayName={user.displayName}
            username={user.username}
            phone={null}
            email={user.email}
          />
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Account</h2>
          <dl className="mt-3 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-1.5 text-muted"><ShieldCheck className="size-3.5" /> Role</dt>
              <dd><Badge tone="outline">{ROLE_LABELS[user.roleId as RoleId] ?? user.roleName}</Badge></dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-1.5 text-muted"><Mail className="size-3.5" /> Email</dt>
              <dd>
                <Badge tone={user.emailVerified ? "success" : "warning"}>
                  {user.emailVerified ? "Verified" : "Unverified"}
                </Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-1.5 text-muted"><CalendarDays className="size-3.5" /> Member since</dt>
              <dd className="text-fg">{formatDate(row?.created_at)}</dd>
            </div>
          </dl>
          <Separator className="my-4" />
          <p className="text-[11px] leading-relaxed text-muted">
            Your email address is used for order notifications, password resets and security alerts. Contact support to
            change it.
          </p>
        </Card>
      </div>
    </div>
  );
}
