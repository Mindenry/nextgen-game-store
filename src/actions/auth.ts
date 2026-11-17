"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  changePassword,
  getCurrentUser,
  localLogin,
  localRegister,
  logout,
  requestPasswordReset,
  resetPasswordWithToken,
  resendVerificationEmail,
  safeNextPath,
  verifyEmailToken,
} from "@/lib/auth";
import { runtimeMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import {
  firstError,
  loginSchema,
  passwordChangeSchema,
  profileSchema,
  registerSchema,
  resetSchema,
} from "@/lib/validation";
import { one, run } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";

export type AuthState = {
  error?: string;
  success?: string;
  devUrl?: string;
  setupRequired?: boolean;
};

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const next = safeNextPath(String(formData.get("next") ?? "/dashboard"), "/dashboard");

  if (runtimeMode === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase!.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) return { error: "Invalid email or password." };
    await audit({ action: "auth.login", entityType: "auth", actorEmail: parsed.data.email });
    redirect(next);
  }

  const result = await localLogin(parsed.data);
  if (!result.ok) return { error: result.error };
  redirect(next);
}

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    displayName: formData.get("displayName"),
    username: formData.get("username") ?? "",
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  if (runtimeMode === "supabase") {
    const settings = await getSettings();
    if (!settings["store.registration_open"]) {
      return { error: "Registration is temporarily closed." };
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase!.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/confirm`,
        data: { full_name: parsed.data.displayName, username: parsed.data.username ?? null },
      },
    });
    if (error) {
      return { error: error.message.includes("already") ? "This email is already registered." : "Could not create the account." };
    }
    if (!data.session) {
      return {
        success: "Check your inbox to confirm your email address, then sign in.",
      };
    }
    redirect("/dashboard");
  }

  const result = await localRegister({
    email: parsed.data.email,
    password: parsed.data.password,
    displayName: parsed.data.displayName,
    username: parsed.data.username || null,
  });
  if (!result.ok) return { error: result.error };
  return {
    success: "Account created. Check your inbox (or .data/outbox in development) to verify your email.",
    devUrl: result.devVerifyUrl,
  };
}

export async function forgotPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email address." };
  await requestPasswordReset(email);
  return {
    success:
      "If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.",
  };
}

export async function resetPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token") ?? "",
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const result = await resetPasswordWithToken(parsed.data.token, parsed.data.password);
  if (!result.ok) return { error: result.error };
  return { success: "Password updated. You can now sign in with your new password." };
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/");
}

export async function oauthAction(formData: FormData): Promise<void> {
  const provider = String(formData.get("provider") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "/dashboard"), "/dashboard");
  if (!["google", "facebook", "discord"].includes(provider)) redirect("/login?error=oauth");
  if (runtimeMode !== "supabase") redirect("/login?error=supabase_required");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase!.auth.signInWithOAuth({
    provider: provider as "google" | "facebook" | "discord",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data.url) redirect("/login?error=oauth_unavailable");
  redirect(data.url);
}

export async function resendVerificationAction(): Promise<AuthState> {
  const result = await resendVerificationEmail();
  if (!result.ok) return { error: result.error ?? "Could not send the verification email." };
  return { success: "Verification email sent.", devUrl: result.devUrl };
}

export async function resendVerificationFormAction(_prev: AuthState, _formData: FormData): Promise<AuthState> {
  return resendVerificationAction();
}

export async function revokeOtherSessionsAction(_prev: AuthState, _formData: FormData): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  const { revokeOtherSessions } = await import("@/lib/auth");
  await revokeOtherSessions(user.id);
  const { audit } = await import("@/lib/audit");
  await audit({ actorId: user.id, actorEmail: user.email, action: "auth.sessions_revoked", entityType: "profile", entityId: user.id });
  return { success: "All other sessions have been signed out." };
}

export async function verifyEmailAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const ok = await verifyEmailToken(token);
  if (ok) {
    const user = await getCurrentUser();
    redirect(user ? "/dashboard?verified=1" : "/login?verified=1");
  }
  redirect("/verify-email?invalid=1");
}

export async function updateProfileAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    username: formData.get("username") || undefined,
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const username = parsed.data.username?.trim().toLowerCase() || null;
  if (username) {
    const existing = await one<{ id: string }>(
      "select id from profiles where lower(username) = $1 and id <> $2",
      [username, user.id],
    );
    if (existing) return { error: "That username is already taken." };
  }
  await run(
    "update profiles set display_name = $1, username = $2, phone = $3, updated_at = now() where id = $4",
    [parsed.data.displayName, username, parsed.data.phone ?? null, user.id],
  );
  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "profile.update",
    entityType: "profile",
    entityId: user.id,
    after: { displayName: parsed.data.displayName, username },
  });
  revalidatePath("/dashboard/profile");
  return { success: "Profile updated." };
}

export async function changePasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const result = await changePassword(parsed.data.currentPassword, parsed.data.newPassword);
  if (!result.ok) return { error: result.error };
  return { success: "Password changed." };
}
