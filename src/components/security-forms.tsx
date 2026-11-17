"use client";

import { useActionState } from "react";
import { Loader2, LogOut, MailCheck, ShieldCheck } from "lucide-react";
import {
  changePasswordAction,
  resendVerificationFormAction,
  revokeOtherSessionsAction,
  type AuthState,
} from "@/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="space-y-3.5">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}
      <Field label="Current password" htmlFor="currentPassword">
        <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
      </Field>
      <Field label="New password" htmlFor="newPassword" hint="At least 8 characters with a letter and a number">
        <Input id="newPassword" name="newPassword" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword">
        <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
        {pending ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}

export function ResendVerificationForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(resendVerificationFormAction, {});
  return (
    <form action={action} className="space-y-2">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert variant="success">
          {state.success}
          {state.devUrl ? (
            <a href={state.devUrl} className="mt-1 block break-all text-[11px] font-semibold underline">
              Development only: open verification link →
            </a>
          ) : null}
        </Alert>
      ) : null}
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <MailCheck className="size-3.5" />}
        Resend verification email
      </Button>
    </form>
  );
}

export function RevokeSessionsForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(revokeOtherSessionsAction, {});
  return (
    <form action={action} className="space-y-2">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}
      <Button type="submit" variant="danger" size="sm" disabled={pending}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
        Sign out other sessions
      </Button>
    </form>
  );
}
