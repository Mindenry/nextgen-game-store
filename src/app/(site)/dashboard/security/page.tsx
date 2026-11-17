import { KeyRound, Laptop, ShieldCheck } from "lucide-react";
import { requireUser, listSessions } from "@/lib/auth";
import { runtimeMode } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { Badge, Card, Separator } from "@/components/ui";
import { ChangePasswordForm, ResendVerificationForm, RevokeSessionsForm } from "@/components/security-forms";

export const metadata = { title: "Security" };

export default async function SecurityPage() {
  const user = await requireUser("/dashboard/security");
  const sessions = await listSessions(user.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Security</p>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">Security settings</h1>
        <p className="mt-1 text-sm text-muted">Protect your account, sessions and delivery vault.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="size-4 text-primary" /> Password
          </h2>
          <p className="mt-1 text-[11px] text-muted">Changing your password signs out other active sessions.</p>
          <div className="mt-4">
            <ChangePasswordForm />
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-primary" /> Email verification
            </h2>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-xs text-muted">{user.email}</p>
              <Badge tone={user.emailVerified ? "success" : "warning"}>{user.emailVerified ? "Verified" : "Unverified"}</Badge>
            </div>
            {!user.emailVerified ? (
              <div className="mt-3">
                <ResendVerificationForm />
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-muted">Your email is verified. Order and security notifications are active.</p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Laptop className="size-4 text-primary" /> Active sessions
            </h2>
            <p className="mt-1 text-[11px] text-muted">
              {runtimeMode === "supabase" ? "Sessions are managed by Supabase Auth." : "Local sessions on this store."}
            </p>
            <div className="mt-3 space-y-2">
              {sessions.length === 0 ? (
                <p className="text-xs text-muted">No additional session data available.</p>
              ) : (
                sessions.slice(0, 5).map((session) => (
                  <div key={session.id} className="rounded-xl border border-border bg-surface-2/50 p-2.5 text-[11px]">
                    <p className="truncate font-medium text-fg">{session.user_agent ?? "Unknown device"}</p>
                    <p className="mt-0.5 text-muted">
                      {session.ip ?? "unknown IP"} · started {formatDate(session.created_at, true)}
                    </p>
                  </div>
                ))
              )}
            </div>
            <Separator className="my-3" />
            <RevokeSessionsForm />
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold">How we protect your account</h2>
        <ul className="mt-3 grid gap-2 text-[11px] text-muted sm:grid-cols-2">
          <li>• Passwords are hashed with scrypt and never stored in plaintext.</li>
          <li>• Sessions use HTTP-only, SameSite cookies and expire automatically.</li>
          <li>• Login and password reset attempts are rate limited.</li>
          <li>• Delivered credentials are encrypted at rest with AES-256-GCM.</li>
          <li>• Admin actions are recorded in an immutable audit log.</li>
          <li>• Payment confirmation is always verified server-side.</li>
        </ul>
      </Card>
    </div>
  );
}
