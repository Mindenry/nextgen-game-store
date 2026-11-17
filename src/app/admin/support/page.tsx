import Link from "next/link";
import { ArrowRight, LifeBuoy } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { listTickets } from "@/lib/admin";
import { formatDate } from "@/lib/utils";
import { Badge, Card, StatusPill, Table, Td, Th } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";

export const metadata = { title: "Support tickets" };

const TABS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.supportView)) return <AccessDenied permission={PERMISSIONS.supportView} />;
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const tickets = await listTickets(status || undefined);

  return (
    <div>
      <PageHeader
        eyebrow="Support"
        title="Support tickets"
        description="Reply to customers, leave internal notes, and update ticket state. Internal notes are never visible to customers."
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <a
            key={tab.value}
            href={tab.value ? `/admin/support?status=${tab.value}` : "/admin/support"}
            className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium ${
              status === tab.value ? "border-primary bg-primary/8 text-primary" : "border-border bg-surface text-muted hover:text-fg"
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      <Card className="p-4">
        <Table className="min-w-[820px]">
          <thead><tr><Th>Ticket</Th><Th>Subject</Th><Th>Customer</Th><Th>Category</Th><Th>Priority</Th><Th>Status</Th><Th>Last activity</Th><Th /></tr></thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <Td className="font-mono text-[10px]">{ticket.ticket_number}</Td>
                <Td>
                  <Link href={`/admin/support/${ticket.id}`} className="text-xs font-medium text-fg hover:text-primary">
                    {ticket.subject}
                  </Link>
                  <p className="text-[9px] text-muted">{ticket.message_count} messages</p>
                </Td>
                <Td>
                  <p className="text-[11px] text-fg">{ticket.display_name}</p>
                  <p className="text-[9px] text-muted">{ticket.email}</p>
                </Td>
                <Td className="text-[10px] capitalize">{ticket.category}</Td>
                <Td><Badge tone={ticket.priority === "urgent" ? "danger" : ticket.priority === "high" ? "warning" : "neutral"} className="capitalize">{ticket.priority}</Badge></Td>
                <Td><StatusPill status={ticket.status} /></Td>
                <Td className="text-[10px]">{formatDate(ticket.last_message_at, true)}</Td>
                <Td>
                  <Link href={`/admin/support/${ticket.id}`} className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
                    Open <ArrowRight className="size-3" />
                  </Link>
                </Td>
              </tr>
            ))}
            {tickets.length === 0 ? <tr><Td colSpan={8} className="py-10 text-center text-xs text-muted">No tickets in this view.</Td></tr> : null}
          </tbody>
        </Table>
      </Card>
      <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted">
        <LifeBuoy className="size-3.5" /> Ticket replies notify the customer in-app.
      </p>
    </div>
  );
}
