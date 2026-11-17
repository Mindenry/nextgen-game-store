import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { oauthAction } from "@/actions/auth";
import type { OAuthAvailability } from "@/lib/auth/oauth";
import { runtimeMode } from "@/lib/env";

const PROVIDERS = [
  { id: "google" as const, label: "Google", mark: "G" },
  { id: "facebook" as const, label: "Facebook", mark: "f" },
  { id: "discord" as const, label: "Discord", mark: "D" },
];

export function SocialButtons({ availability, next = "/dashboard" }: { availability: OAuthAvailability; next?: string }) {
  const anyEnabled = PROVIDERS.some((provider) => availability[provider.id]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">or continue with</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {PROVIDERS.map((provider) => {
          const enabled = availability[provider.id];
          return enabled ? (
            <form key={provider.id} action={oauthAction}>
              <input type="hidden" name="provider" value={provider.id} />
              <input type="hidden" name="next" value={next} />
              <button
                type="submit"
                className="focus-ring flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface text-xs font-semibold text-fg transition hover:border-border-strong hover:bg-surface-2"
              >
                <span className="grid size-5 place-items-center rounded-md bg-fg text-[10px] font-bold text-bg">
                  {provider.mark}
                </span>
                {provider.label}
              </button>
            </form>
          ) : (
            <button
              key={provider.id}
              type="button"
              disabled
              title={
                runtimeMode === "supabase"
                  ? `${provider.label} is not enabled in Supabase Authentication`
                  : "Requires Supabase Auth"
              }
              className="flex h-10 w-full cursor-not-allowed flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-2/50 text-[10px] font-medium text-muted"
            >
              <span>{provider.label}</span>
              <span className="text-[9px] text-warning">Setup required</span>
            </button>
          );
        })}
      </div>
      {!anyEnabled ? (
        <div className="flex gap-2 rounded-xl border border-warning/25 bg-warning/8 p-3 text-[11px] text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <p>
            Social login is not configured yet.{" "}
            {runtimeMode === "supabase" ? (
              <Link href="/auth/error" className="font-semibold underline">
                Check provider setup
              </Link>
            ) : (
              <>
                Email &amp; password works now. See{" "}
                <span className="font-mono">docs/OAUTH_SETUP.md</span> to enable Google, Facebook or Discord.
              </>
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}
