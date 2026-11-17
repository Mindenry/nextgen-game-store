import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { runtimeMode } from "@/lib/env";
import { buttonClass } from "@/components/ui";
import { ResetPasswordForm } from "@/components/auth/password-forms";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const user = await getCurrentUser();

  const showForm = runtimeMode === "supabase" ? Boolean(user) : token.length > 20;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Set a new password</h1>
      <p className="mt-1.5 text-sm text-muted">
        Choose a strong password you don&apos;t use anywhere else. Reset links are single-use and expire quickly.
      </p>

      <div className="mt-6">
        {showForm ? (
          <ResetPasswordForm token={token || "supabase-session"} />
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="text-sm font-semibold text-fg">This reset link is invalid or has expired.</p>
            <p className="mt-1 text-xs text-muted">Request a new link and try again.</p>
            <Link href="/forgot-password" className={buttonClass({ className: "mt-4" })}>
              Request a new link
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
