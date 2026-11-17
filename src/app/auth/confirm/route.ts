import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getCurrentUser, safeNextPath } from "@/lib/auth";
import { runtimeMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNextPath(url.searchParams.get("next"), "/dashboard");
  if (runtimeMode !== "supabase") {
    return NextResponse.redirect(new URL("/login?error=supabase_required", url.origin));
  }
  if (!tokenHash || !type) return NextResponse.redirect(new URL("/auth/error", url.origin));

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.redirect(new URL("/login?error=supabase_required", url.origin));
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as "signup" | "email" | "recovery" | "invite" | "magiclink" | "email_change",
  });
  if (error) {
    console.error("[auth/confirm]", error.message);
    return NextResponse.redirect(new URL("/auth/error", url.origin));
  }
  await getCurrentUser();
  return NextResponse.redirect(new URL(next, url.origin));
}
