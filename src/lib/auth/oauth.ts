import "server-only";
import { env, runtimeMode } from "@/lib/env";

export type OAuthProvider = "google" | "facebook" | "discord";
export type OAuthAvailability = Record<OAuthProvider, boolean>;

type Cache = { at: number; value: OAuthAvailability };
const g = globalThis as typeof globalThis & { __ngsOAuthCache?: Cache };

/**
 * Reads the providers actually enabled on the Supabase project.
 * We never render a social button that cannot work.
 */
export async function getOAuthAvailability(): Promise<OAuthAvailability> {
  const off: OAuthAvailability = { google: false, facebook: false, discord: false };
  if (runtimeMode !== "supabase") return off;
  if (g.__ngsOAuthCache && Date.now() - g.__ngsOAuthCache.at < 60_000) return g.__ngsOAuthCache.value;

  try {
    const response = await fetch(`${env.supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: env.supabaseAnonKey, Authorization: `Bearer ${env.supabaseAnonKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return off;
    const body = (await response.json()) as { external?: Record<string, boolean> };
    const value: OAuthAvailability = {
      google: Boolean(body.external?.google),
      facebook: Boolean(body.external?.facebook),
      discord: Boolean(body.external?.discord),
    };
    g.__ngsOAuthCache = { at: Date.now(), value };
    return value;
  } catch {
    return off;
  }
}
