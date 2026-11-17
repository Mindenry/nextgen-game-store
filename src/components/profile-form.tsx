"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import { updateProfileAction, type AuthState } from "@/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export function ProfileForm({
  displayName,
  username,
  phone,
  email,
}: {
  displayName: string;
  username: string | null;
  phone: string | null;
  email: string;
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(updateProfileAction, {});
  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Display name" htmlFor="displayName" required>
          <Input id="displayName" name="displayName" defaultValue={displayName} required minLength={2} maxLength={60} />
        </Field>
        <Field label="Username" htmlFor="username" hint="Letters, numbers and underscore">
          <Input id="username" name="username" defaultValue={username ?? ""} pattern="[A-Za-z0-9_]*" maxLength={24} />
        </Field>
        <Field label="Email" htmlFor="email" hint="Email changes require support verification">
          <Input id="email" value={email} readOnly disabled />
        </Field>
        <Field label="Phone" htmlFor="phone" hint="Optional">
          <Input id="phone" name="phone" defaultValue={phone ?? ""} maxLength={20} placeholder="+66…" />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
