import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { many, one } from "@/lib/db";
import { closeTicketAction } from "@/actions/account";
import { formatDate } from "@/lib/utils";
import { Badge, buttonClass, Card, Separator, StatusPill } from "@/components/ui";
import { TicketReplyForm } from "@/components/ticket-forms";

export default async function TicketThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/support/${id}`);
  const ticket = await one<{
    id: string;
    ticket_number: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    created_at: string;
  }>(
    "select id, ticket_number, subject, category, priority, status, created_at from support_tickets where id = $1::uuid and user_id = $2",
    [id, user.id],
  );
  if (!ticket) notFound();
  const messages = await many<{
    id: string;
    body: string;
    is_internal: boolean;
    created_at: string;
    author_name: string | null;
    author_role: string | null;
    author_id: string | null;
  }>(
    `select m.id, m.body, m.is_internal, m.created_at,
            coalesce(p.display_name, 'Support') as author_name, p.role_id as author_role, m.author_id
     from support_messages m left join profiles p on p.id = m.author_id
     where m.ticket_id = $1 and m.is_internal = false order by m.created_at asc`,
    [ticket.id],
  );

  return (
    <div className="space-y-6">
      <Link href="/dashboard/support" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> Support
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] text-muted">{ticket.ticket_number}</p>
          <h1 className="mt-1 text-2xl font-semibold">{ticket.subject}</h1>
          <p className="mt-1 text-xs text-muted">
            <span className="capitalize">{ticket.category}</span> · Opened {formatDate(ticket.created_at, true)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={ticket.priority === "urgent" ? "danger" : ticket.priority === "high" ? "warning" : "neutral"} className="capitalize">
            {ticket.priority}
          </Badge>
          <StatusPill status={ticket.status} />
        </div>
      </div>

      <Card className="p-5">
        <div className="space-y-4">
          {messages.map((message) => {
            const staff = message.author_role && message.author_role !== "customer";
            return (
              <div key={message.id} className={`flex gap-3 ${staff ? "flex-row-reverse text-right" : ""}`}>
                <span className={`grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-bold ${staff ? "bg-primary/10 text-primary" : "bg-surface-2 text-fg-soft"}`}>
                  {(message.author_name ?? "S").slice(0, 1).toUpperCase()}
                </span>
                <div className={`max-w-[80%] rounded-2xl border p-3.5 ${staff ? "border-primary/20 bg-primary/5" : "border-border bg-surface-2/60"}`}>
                  <div className={`flex items-center gap-2 text-[10px] text-muted ${staff ? "justify-end" : ""}`}>
                    <span className="font-semibold text-fg-soft">{message.author_name}</span>
                    {staff ? <Badge tone="primary" className="text-[8px]">Staff</Badge> : null}
                    <span>{formatDate(message.created_at, true)}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-fg-soft">{message.body}</p>
                </div>
              </div>
            );
          })}
        </div>
        <Separator className="my-5" />
        {ticket.status === "closed" ? (
          <p className="text-xs text-muted">This ticket is closed. Open a new ticket if you need more help.</p>
        ) : (
          <>
            <TicketReplyForm ticketId={ticket.id} />
            <form action={closeTicketAction} className="mt-3 text-right">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <button type="submit" className="text-[11px] text-muted underline hover:text-fg">
                Close this ticket
              </button>
            </form>
          </>
        )}
      </Card>

      <p className="flex items-center gap-1.5 text-[10px] text-muted">
        <ShieldCheck className="size-3.5 text-success" /> Replies from our team are recorded with staff identity and timestamp.
      </p>
      <Link href="/dashboard/orders" className={buttonClass({ variant: "ghost", size: "sm" })}>
        View my orders
      </Link>
    </div>
  );
}
