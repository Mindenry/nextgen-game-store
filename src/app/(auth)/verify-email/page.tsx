import Link from "next/link";
import { MailCheck, ShieldAlert } from "lucide-react";
import { verifyEmailAction } from "@/actions/auth";
import { runtimeMode } from "@/lib/env";
import { buttonClass } from "@/components/ui";

export const metadata = { title: "Verify email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const invalid = params.invalid === "1";

  return (
    <div className="text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <MailCheck className="size-6" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold">Verify your email</h1>

      {invalid ? (
        <div className="mt-4 rounded-xl border border-danger/25 bg-danger/8 p-4 text-left text-sm text-danger">
          <p className="flex items-center gap-2 font-semibold"><ShieldAlert className="size-4" /> Link invalid or expired</p>
          <p className="mt-1 text-xs">Request a new verification email from Account → Security after signing in.</p>
        </div>
      ) : token ? (
        <>
          <p className="mt-2 text-sm text-muted">
            Confirm your email address to unlock checkout and secure order notifications.
          </p>
          <form action={verifyEmailAction} className="mt-6">
            <input type="hidden" name="token" value={token} />
            <button type="submit" className={buttonClass({ size: "lg", className: "w-full" })}>
              Verify my email
            </button>
          </form>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">
          {runtimeMode === "supabase"
            ? "Open the verification link from your inbox, or resend it from Account → Security."
            : "Open the verification link from your inbox. In development, links are written to .data/outbox and the server console."}
        </p>
      )}

      <p className="mt-5 text-xs text-muted">
        <Link href="/dashboard/security" className="font-medium text-primary hover:underline">Account security</Link>
        {" · "}
        <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
