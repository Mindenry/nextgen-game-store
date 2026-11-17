import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { getOAuthAvailability } from "@/lib/auth/oauth";
import { runtimeMode } from "@/lib/env";
import { buttonClass } from "@/components/ui";

export const metadata = { title: "Authentication setup" };

export default async function AuthErrorPage() {
  const availability = await getOAuthAvailability();
  return (
    <div>
      <div className="grid size-12 place-items-center rounded-2xl bg-warning/10 text-warning">
        <AlertTriangle className="size-6" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold">Authentication setup required</h1>
      <p className="mt-2 text-sm text-muted">
        The sign-in link is invalid or the provider is not configured. Nothing was changed and no access was granted.
      </p>

      <div className="mt-5 space-y-2 rounded-xl border border-border bg-surface p-4 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Provider status</p>
        {(["google", "facebook", "discord"] as const).map((provider) => (
          <div key={provider} className="flex items-center justify-between text-xs capitalize">
            <span className="text-fg-soft">{provider}</span>
            <span className={availability[provider] ? "font-semibold text-success" : "font-medium text-warning"}>
              {runtimeMode !== "supabase"
                ? "Requires Supabase Auth"
                : availability[provider]
                  ? "Enabled"
                  : "Setup required"}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Follow <span className="font-mono text-fg">docs/OAUTH_SETUP.md</span> to configure redirect URLs and provider
        credentials, or use email &amp; password sign-in, which is available now.
      </p>

      <Link href="/login" className={buttonClass({ variant: "outline", className: "mt-5 w-full" })}>
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </div>
  );
}
