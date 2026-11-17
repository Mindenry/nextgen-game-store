import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { many, one, run } from "@/lib/db";
import { env, isProduction, runtimeMode } from "@/lib/env";
import { hashPassword, randomToken, sha256, verifyPassword } from "@/lib/crypto";
import { sendMail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import type { SessionUser, RoleId } from "@/lib/auth/rbac";

export const SESSION_COOKIE = "ngs_session";
const SESSION_DAYS = 30;

type ProfileRow = {
  id: string;
  email: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  role_id: RoleId;
  role_name: string;
  status: "active" | "suspended" | "deleted";
  email_verified_at: string | null;
  permissions: string[] | null;
};

async function loadProfile(id: string): Promise<SessionUser | null> {
  const row = await one<ProfileRow>(
    `select p.id, p.email, p.display_name, p.username, p.avatar_url, p.role_id, p.status,
            p.email_verified_at, r.name as role_name,
            coalesce(array_agg(rp.permission_id) filter (where rp.permission_id is not null), '{}') as permissions
     from profiles p
     join roles r on r.id = p.role_id
     left join role_permissions rp on rp.role_id = p.role_id
     where p.id = $1
     group by p.id, r.name`,
    [id],
  );
  if (!row || row.status !== "active") return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    username: row.username,
    avatarUrl: row.avatar_url,
    roleId: row.role_id,
    roleName: row.role_name,
    status: row.status,
    emailVerified: Boolean(row.email_verified_at),
    permissions: row.permissions ?? [],
  };
}

/** Request-scoped current user. Never trusts client-supplied identity. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  if (runtimeMode === "supabase") {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const authUser = data.user;

    let row = await one<{ id: string }>("select id from profiles where id = $1", [authUser.id]);
    if (!row) {
      const displayName =
        (authUser.user_metadata?.full_name as string) ||
        (authUser.user_metadata?.name as string) ||
        authUser.email?.split("@")[0] ||
        "Player";
      await run(
        `insert into profiles(id, email, display_name, avatar_url, email_verified_at)
         values ($1, $2, $3, $4, $5::timestamptz)
         on conflict (id) do nothing`,
        [
          authUser.id,
          authUser.email ?? `${authUser.id}@oauth.local`,
          displayName,
          (authUser.user_metadata?.avatar_url as string) ?? null,
          authUser.email_confirmed_at ?? null,
        ],
      );
      row = await one<{ id: string }>("select id from profiles where id = $1", [authUser.id]);
    }
    if (!row) return null;
    return loadProfile(row.id);
  }

  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await one<{ user_id: string; expires_at: string }>(
    "select user_id, expires_at from sessions where token_hash = $1",
    [sha256(token)],
  );
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await run("delete from sessions where token_hash = $1", [sha256(token)]);
    return null;
  }
  return loadProfile(session.user_id);
});

/** Only accepts same-origin relative paths to prevent open redirects. */
export function safeNextPath(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

export async function requireUser(nextPath = "/dashboard"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export async function requireStaff(nextPath = "/admin"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (user.roleId === "customer") redirect("/dashboard?denied=admin");
  return user;
}

// ---------------------------------------------------------------------------
// Local session auth
// ---------------------------------------------------------------------------
async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  const requestHeaders = await headers();
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await run(
    `insert into sessions(id, user_id, token_hash, ip, user_agent, expires_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      randomUUID(),
      userId,
      sha256(token),
      clientIp(requestHeaders),
      requestHeaders.get("user-agent")?.slice(0, 300) ?? null,
      expires.toISOString(),
    ],
  );
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    expires,
  });
}

export async function localRegister(input: {
  email: string;
  password: string;
  displayName: string;
  username?: string | null;
}): Promise<{ ok: true; devVerifyUrl?: string } | { ok: false; error: string }> {
  const h = await headers();
  const ip = clientIp(h);
  const limit = await rateLimit(`register:${ip}`, 5, 3600);
  if (!limit.allowed) return { ok: false, error: "Too many attempts. Please try again later." };

  const settings = await getSettings();
  if (!settings["store.registration_open"]) {
    return { ok: false, error: "Registration is temporarily closed." };
  }
  const email = input.email.trim().toLowerCase();
  const username = input.username?.trim().toLowerCase() || null;

  if (await one("select id from profiles where email_lower = $1", [email])) {
    // Do not confirm account existence. Notify the real owner instead.
    await sendMail({
      to: email,
      subject: "Someone tried to register with your email",
      text: "An account already exists for this email. If this was you, sign in or reset your password.",
    });
    return { ok: true };
  }
  if (username && (await one("select id from profiles where lower(username) = $1", [username]))) {
    return { ok: false, error: "That username is already taken." };
  }

  const passwordHash = await hashPassword(input.password);
  const inserted = await one<{ id: string }>(
    `insert into profiles(email, password_hash, display_name, username)
     values ($1, $2, $3, $4) returning id`,
    [email, passwordHash, input.displayName.trim(), username],
  );
  if (!inserted) return { ok: false, error: "Could not create the account." };

  await run(
    `insert into notifications(user_id, type, title, body, link)
     values ($1, 'account', 'Welcome to NEXTGEN GAME STORE', 'Your account is ready. Top up your wallet to start shopping.', '/dashboard')`,
    [inserted.id],
  );

  const verify = await issueToken(inserted.id, "verify", 24);
  const verifyUrl = `${env.appUrl}/verify-email?token=${verify}`;
  await sendMail({
    to: email,
    subject: "Verify your NEXTGEN GAME STORE email",
    text: `Welcome! Verify your email to complete checkout:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
  });
  await audit({
    actorId: inserted.id,
    actorEmail: email,
    action: "auth.register",
    entityType: "profile",
    entityId: inserted.id,
  });
  return { ok: true, devVerifyUrl: isProduction ? undefined : verifyUrl };
}

export async function localLogin(input: {
  email: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const h = await headers();
  const ip = clientIp(h);
  const email = input.email.trim().toLowerCase();
  const [ipLimit, emailLimit] = await Promise.all([
    rateLimit(`login-ip:${ip}`, 60, 900),
    rateLimit(`login-email:${email}`, 20, 900),
  ]);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    return { ok: false, error: "Too many sign-in attempts. Please wait 15 minutes." };
  }

  const row = await one<{
    id: string;
    password_hash: string | null;
    status: string;
  }>("select id, password_hash, status from profiles where email_lower = $1", [email]);

  const valid = row ? await verifyPassword(input.password, row.password_hash) : false;
  if (!row || !valid) {
    await audit({ action: "auth.login_failed", entityType: "auth", entityId: email, actorEmail: email });
    return { ok: false, error: "Invalid email or password." };
  }
  if (row.status !== "active") {
    return { ok: false, error: "This account is suspended. Contact support." };
  }

  await createSession(row.id);
  await run("update profiles set last_login_at = now() where id = $1", [row.id]);
  await run("delete from sessions where expires_at < now()");
  await audit({ actorId: row.id, actorEmail: email, action: "auth.login", entityType: "profile", entityId: row.id });
  return { ok: true };
}

export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await run("delete from sessions where token_hash = $1", [sha256(token)]);
  if (runtimeMode === "supabase") {
    const supabase = await createSupabaseServerClient();
    await supabase?.auth.signOut();
  }
  store.delete(SESSION_COOKIE);
}

async function issueToken(userId: string, kind: "reset" | "verify", hours: number): Promise<string> {
  const token = randomToken(32);
  await run(
    `insert into password_reset_tokens(user_id, token_hash, kind, expires_at)
     values ($1, $2, $3, now() + make_interval(hours => $4::int))`,
    [userId, sha256(token), kind, hours],
  );
  return token;
}

export async function requestPasswordReset(emailInput: string): Promise<void> {
  const h = await headers();
  const ip = clientIp(h);
  await rateLimit(`reset:${ip}`, 5, 3600);
  const email = emailInput.trim().toLowerCase();

  if (runtimeMode === "supabase") {
    const supabase = await createSupabaseServerClient();
    await supabase?.auth.resetPasswordForEmail(email, {
      redirectTo: `${env.appUrl}/auth/callback?next=/reset-password`,
    });
    return;
  }

  const row = await one<{ id: string; status: string }>(
    "select id, status from profiles where email_lower = $1",
    [email],
  );
  if (!row || row.status !== "active") return; // anti-enumeration: always silent
  const token = await issueToken(row.id, "reset", 1);
  await sendMail({
    to: email,
    subject: "Reset your NEXTGEN GAME STORE password",
    text: `Use this link to choose a new password (valid for 1 hour):\n${env.appUrl}/reset-password?token=${token}\n\nIf you did not request this, you can ignore this email.`,
  });
  await audit({ actorId: row.id, actorEmail: email, action: "auth.password_reset_requested", entityType: "profile", entityId: row.id });
}

export async function resetPasswordWithToken(
  token: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (runtimeMode === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase!.auth.updateUser({ password });
    if (error) return { ok: false, error: "Could not update the password. Open the reset link again." };
    return { ok: true };
  }
  const row = await one<{ id: string; user_id: string }>(
    `select id, user_id from password_reset_tokens
     where token_hash = $1 and kind = 'reset' and used_at is null and expires_at > now()`,
    [sha256(token)],
  );
  if (!row) return { ok: false, error: "This reset link is invalid or has expired." };
  const hash = await hashPassword(password);
  await run("update profiles set password_hash = $1 where id = $2", [hash, row.user_id]);
  await run("update password_reset_tokens set used_at = now() where id = $1", [row.id]);
  await run("delete from sessions where user_id = $1", [row.user_id]);
  await audit({ actorId: row.user_id, action: "auth.password_reset", entityType: "profile", entityId: row.user_id });
  return { ok: true };
}

export async function verifyEmailToken(token: string): Promise<boolean> {
  const row = await one<{ id: string; user_id: string }>(
    `select id, user_id from password_reset_tokens
     where token_hash = $1 and kind = 'verify' and used_at is null and expires_at > now()`,
    [sha256(token)],
  );
  if (!row) return false;
  await run("update profiles set email_verified_at = now() where id = $1", [row.user_id]);
  await run("update password_reset_tokens set used_at = now() where id = $1", [row.id]);
  return true;
}

export async function resendVerificationEmail(): Promise<{ ok: boolean; devUrl?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  if (user.emailVerified) return { ok: false, error: "Your email is already verified." };
  if (runtimeMode === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase!.auth.resend({
      type: "signup",
      email: user.email,
      options: { emailRedirectTo: `${env.appUrl}/auth/confirm` },
    });
    return error ? { ok: false, error: "Could not resend the email." } : { ok: true };
  }
  const token = await issueToken(user.id, "verify", 24);
  const url = `${env.appUrl}/verify-email?token=${token}`;
  await sendMail({
    to: user.email,
    subject: "Verify your NEXTGEN GAME STORE email",
    text: `Verify your email (valid 24 hours):\n${url}`,
  });
  return { ok: true, devUrl: isProduction ? undefined : url };
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };

  if (runtimeMode === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase!.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message };
    await audit({ actorId: user.id, actorEmail: user.email, action: "auth.password_changed", entityType: "profile", entityId: user.id });
    return { ok: true };
  }

  const row = await one<{ password_hash: string | null }>(
    "select password_hash from profiles where id = $1",
    [user.id],
  );
  if (!(await verifyPassword(currentPassword, row?.password_hash ?? null))) {
    return { ok: false, error: "Current password is incorrect." };
  }
  await run("update profiles set password_hash = $1 where id = $2", [
    await hashPassword(newPassword),
    user.id,
  ]);
  await audit({ actorId: user.id, actorEmail: user.email, action: "auth.password_changed", entityType: "profile", entityId: user.id });
  return { ok: true };
}

export async function listSessions(userId: string) {
  if (runtimeMode === "supabase") return [];
  return many<{ id: string; ip: string | null; user_agent: string | null; created_at: string; expires_at: string }>(
    "select id, ip, user_agent, created_at, expires_at from sessions where user_id = $1 order by created_at desc",
    [userId],
  );
}

export async function revokeOtherSessions(userId: string): Promise<void> {
  if (runtimeMode === "supabase") {
    const supabase = await createSupabaseServerClient();
    await supabase?.auth.signOut({ scope: "others" });
    return;
  }
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return;
  await run("delete from sessions where user_id = $1 and token_hash <> $2", [userId, sha256(token)]);
}

export { loadProfile };
