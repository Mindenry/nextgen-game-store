import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, safeNextPath } from "@/lib/auth";
import { getOAuthAvailability } from "@/lib/auth/oauth";
import { runtimeMode } from "@/lib/env";
import { Alert, Badge } from "@/components/ui";
import { LoginForm } from "@/components/auth/login-form";
import { SocialButtons } from "@/components/social-buttons";

export const metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  supabase_required: "Social sign-in requires Supabase Auth. Email and password sign-in is available now.",
  oauth_unavailable: "That social provider is not enabled. Ask an administrator to configure it in Supabase.",
  oauth: "Social sign-in could not be completed. Please try again.",
  session: "Your session expired. Sign in again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : "/dashboard");
  const user = await getCurrentUser();
  if (user) redirect(next);
  const availability = await getOAuthAvailability();
  const errorCode = typeof params.error === "string" ? params.error : "";

  return (
    <div>
      <div className="mb-7">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <Badge tone="outline">{runtimeMode === "supabase" ? "Supabase Auth" : "Local dev auth"}</Badge>
        </div>
        <p className="mt-1.5 text-sm text-muted">Sign in to manage your orders, wallet and delivered products.</p>
      </div>

      {errorCode ? (
        <Alert variant="warning" className="mb-4">
          {NOTICES[errorCode] ?? "Sign-in could not be completed."}
        </Alert>
      ) : null}
      {params.verified === "1" ? (
        <Alert variant="success" className="mb-4">Email verified. You can sign in now.</Alert>
      ) : null}
      {params.registered === "1" ? (
        <Alert variant="success" className="mb-4">Account created. Check your email to verify, then sign in.</Alert>
      ) : null}

      <LoginForm next={next} />

      <div className="mt-6">
        <SocialButtons availability={availability} next={next} />
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        New to NEXTGEN?{" "}
        <Link href="/register" className="font-semibold text-primary hover:underline">Create an account</Link>
      </p>
    </div>
  );
}
