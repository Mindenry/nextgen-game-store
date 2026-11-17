"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2, MailQuestion, ShieldCheck } from "lucide-react";
import { forgotPasswordAction, resetPasswordAction, type AuthState } from "@/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(forgotPasswordAction, {});
  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success" title="Check your inbox">{state.success}</Alert> : null}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" required placeholder="you@example.com" autoComplete="email" />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <MailQuestion className="size-4" />}
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-xs text-muted">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(resetPasswordAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert variant="success" title="Password updated">
          <Link href="/login" className="font-semibold underline">
            Sign in with your new password →
          </Link>
        </Alert>
      ) : null}
      <Field label="New password" htmlFor="password" hint="At least 8 characters, with a letter and a number">
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword">
        <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending || Boolean(state.success)}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
        {pending ? "Updating…" : "Set new password"}
      </Button>
    </form>
  );
}
