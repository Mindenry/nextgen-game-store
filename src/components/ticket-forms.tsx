"use client";

import { useActionState } from "react";
import { Loader2, Send } from "lucide-react";
import { createTicketAction, replyTicketFormAction, type FormState } from "@/actions/account";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

export function TicketForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createTicketAction, {});
  return (
    <form action={action} className="space-y-3.5">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <Field label="Subject" htmlFor="subject" required>
        <Input id="subject" name="subject" required minLength={5} maxLength={120} placeholder="Issue with order NGS-…" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category" htmlFor="category">
          <Select id="category" name="category" defaultValue="general">
            <option value="general">General</option>
            <option value="order">Order</option>
            <option value="payment">Payment</option>
            <option value="delivery">Delivery</option>
            <option value="account">Account</option>
          </Select>
        </Field>
        <Field label="Priority" htmlFor="priority">
          <Select id="priority" name="priority" defaultValue="normal">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </Field>
      </div>
      <Field label="Message" htmlFor="message" required>
        <Textarea id="message" name="message" required minLength={10} maxLength={4000} rows={5} placeholder="Include your order number, payment reference and as much detail as possible." />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {pending ? "Opening ticket…" : "Open ticket"}
      </Button>
    </form>
  );
}

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(replyTicketFormAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}
      <Textarea name="body" required minLength={2} maxLength={4000} rows={4} placeholder="Write a reply…" />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
        Send reply
      </Button>
    </form>
  );
}
