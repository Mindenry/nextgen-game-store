import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getCurrentUser, safeNextPath } from "@/lib/auth";
import { runtimeMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"), "/dashboard");
  if (runtimeMode !== "supabase") {
    return NextResponse.redirect(new URL("/login?error=supabase_required", url.origin));
  }
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=oauth", url.origin));

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.redirect(new URL("/login?error=supabase_required", url.origin));
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback]", error.message);
    return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  }

  // Ensures the public profile row exists (the DB trigger normally handles it).
  await getCurrentUser();
  return NextResponse.redirect(new URL(next, url.origin));
}
