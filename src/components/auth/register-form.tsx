"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { registerAction, type AuthState } from "@/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(registerAction, {});

  return (
    <form action={action} className="space-y-3.5">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert variant="success" title="Account created">
          <p>{state.success}</p>
          {state.devUrl ? (
            <a href={state.devUrl} className="mt-2 inline-block break-all text-[11px] font-semibold text-primary underline">
              Development only: verify email now →
            </a>
          ) : null}
          <p className="mt-2 text-[11px]">
            <Link href="/login" className="font-semibold text-primary underline">
              Go to sign in
            </Link>
          </p>
        </Alert>
      ) : null}

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Display name" htmlFor="displayName">
          <Input id="displayName" name="displayName" required minLength={2} maxLength={60} placeholder="Your name" />
        </Field>
        <Field label="Username" htmlFor="username" hint="Optional">
          <Input id="username" name="username" pattern="[A-Za-z0-9_]+" maxLength={24} placeholder="player_one" />
        </Field>
      </div>

      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </Field>

      <Field label="Password" htmlFor="password" hint="At least 8 characters, with a letter and a number">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="••••••••" />
      </Field>

      <Field label="Confirm password" htmlFor="confirmPassword">
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} placeholder="••••••••" />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-xs text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
