import Link from "next/link";
import { ArrowRight, LifeBuoy, MessageSquare } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { many } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Badge, buttonClass, Card, EmptyState, StatusPill } from "@/components/ui";
import { TicketForm } from "@/components/ticket-forms";

export const metadata = { title: "Support" };

export default async function SupportPage() {
  const user = await requireUser("/dashboard/support");
  const tickets = await many<{
    id: string;
    ticket_number: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    created_at: string;
    last_message_at: string;
    message_count: number;
  }>(
    `select t.id, t.ticket_number, t.subject, t.category, t.priority, t.status, t.created_at, t.last_message_at,
            (select count(*)::int from support_messages m where m.ticket_id = t.id) as message_count
     from support_tickets t where t.user_id = $1 order by t.last_message_at desc`,
    [user.id],
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Help centre</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold md:text-3xl">
          <LifeBuoy className="size-6 text-primary" /> Support
        </h1>
        <p className="mt-1 text-sm text-muted">Open a ticket and our team will reply in this thread.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_420px] lg:items-start">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Your tickets</h2>
          {tickets.length === 0 ? (
            <EmptyState icon={<MessageSquare className="size-5" />} title="No tickets yet" description="Open one with the form on this page." />
          ) : (
            tickets.map((ticket) => (
              <Link key={ticket.id} href={`/dashboard/support/${ticket.id}`} className="surface-card block p-4 transition hover:border-border-strong">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-fg">{ticket.subject}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted">{ticket.ticket_number}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <BottomPriority priority={ticket.priority} />
                    <StatusPill status={ticket.status} />
                    <ArrowRight className="size-3.5 text-muted" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[10px] text-muted">
                  <span className="capitalize">{ticket.category}</span>
                  <span>{ticket.message_count} messages</span>
                  <span>Last activity {formatDate(ticket.last_message_at, true)}</span>
                </div>
              </Link>
            ))
          )}
        </div>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Open a new ticket</h2>
          <p className="mt-1 text-[11px] text-muted">Include the order number or payment reference to speed things up.</p>
          <div className="mt-4">
            <TicketForm />
          </div>
        </Card>
      </div>
    </div>
  );
}

function BottomPriority({ priority }: { priority: string }) {
  const tone = priority === "urgent" ? "danger" : priority === "high" ? "warning" : "neutral";
  return <Badge tone={tone} className="capitalize">{priority}</Badge>;
}
