"use client";

import { useActionState } from "react";
import { Loader2, Star } from "lucide-react";
import { submitReviewAction, type FormState } from "@/actions/account";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";

export function ReviewForm({ orderItemId }: { orderItemId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitReviewAction, {});
  if (state.success) return <Alert variant="success">{state.success}</Alert>;

  return (
    <form action={action} className="mt-3 space-y-3 rounded-xl border border-border bg-surface-2/50 p-4">
      <input type="hidden" name="orderItemId" value={orderItemId} />
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <Field label="Rating">
        <div className="flex gap-1">
          {[5, 4, 3, 2, 1].map((value) => (
            <label key={value} className="cursor-pointer">
              <input type="radio" name="rating" value={value} required className="peer sr-only" />
              <span className="flex items-center gap-0.5 rounded-lg border border-border px-2 py-1 text-[11px] text-muted transition peer-checked:border-warning/40 peer-checked:bg-warning/10 peer-checked:text-warning">
                {value} <Star className="size-3 fill-current" />
              </span>
            </label>
          ))}
        </div>
      </Field>
      <Field label="Title (optional)">
        <Input name="title" maxLength={100} placeholder="Great value" />
      </Field>
      <Field label="Review (optional)">
        <Textarea name="body" maxLength={2000} rows={3} placeholder="Tell other players about your experience" />
      </Field>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        Submit for moderation
      </Button>
    </form>
  );
}
