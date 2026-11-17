"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Button } from "@/components/ui";

type Result = { error?: string; success?: string };
type Action = (prev: Result, formData: FormData) => Promise<Result>;

export function AdminActionForm({
  action,
  children,
  submitLabel,
  className,
  submitVariant = "primary",
  compact,
}: {
  action: Action;
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
  submitVariant?: "primary" | "secondary" | "danger" | "success" | "outline";
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState<Result, FormData>(action, {});
  return (
    <form action={formAction} className={className}>
      {state.error ? <Alert variant="danger" className="mb-3">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success" className="mb-3">{state.success}</Alert> : null}
      {children}
      <div className={compact ? "" : "mt-4"}>
        <Button type="submit" variant={submitVariant} disabled={pending} size={compact ? "sm" : "md"}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
