import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env, runtimeMode } from "@/lib/env";

export function isSupabaseAuth(): boolean {
  return runtimeMode === "supabase";
}

/**
 * Request-scoped Supabase server client. Only used for Supabase Auth and
 * Storage; business data goes through the privileged SQL layer.
 */
export async function createSupabaseServerClient() {
  if (!isSupabaseAuth()) return null;
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render — middleware refreshes the
          // session cookie instead.
        }
      },
    },
  });
}
