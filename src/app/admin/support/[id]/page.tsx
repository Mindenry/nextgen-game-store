import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { getTicketDetail } from "@/lib/admin";
import { setTicketStatusFormAction } from "@/actions/admin-content";
import { formatDate } from "@/lib/utils";
import { Badge, Card, Input, StatusPill, Textarea } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import { replyTicketAdminAction } from "@/actions/admin-content";

export const metadata = { title: "Ticket" };

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.supportView)) return <AccessDenied permission={PERMISSIONS.supportView} />;
  const { id } = await params;
  const data = await getTicketDetail(id);
  if (!data) notFound();
  const canReply = can(user, PERMISSIONS.supportReply);

  return (
    <div>
      <Link href="/admin/support" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> Support tickets
      </Link>
      <PageHeader
        eyebrow={data.ticket.ticket_number}
        title={data.ticket.subject}
        description={`${data.ticket.display_name} · ${data.ticket.email} · opened ${formatDate(data.ticket.created_at, true)}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={data.ticket.priority === "urgent" ? "danger" : data.ticket.priority === "high" ? "warning" : "neutral"} className="capitalize">
              {data.ticket.priority}
            </Badge>
            <StatusPill status={data.ticket.status} />
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_340px] xl:items-start">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Conversation</h2>
          <div className="mt-4 space-y-4">
            {data.messages.map((message) => {
              const staff = message.author_role && message.author_role !== "customer";
              return (
                <div key={message.id} className={`rounded-xl border p-3.5 ${message.is_internal ? "border-warning/30 bg-warning/5" : "border-border bg-surface-2/40"}`}>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted">
                    <span className="font-semibold text-fg-soft">{message.author_name}</span>
                    {staff ? <Badge tone="primary" className="text-[8px]">Staff</Badge> : <Badge tone="neutral" className="text-[8px]">Customer</Badge>}
                    {message.is_internal ? <Badge tone="warning" className="text-[8px]">Internal note</Badge> : null}
                    <span>{formatDate(message.created_at, true)}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-fg-soft">{message.body}</p>
                </div>
              );
            })}
          </div>

          {canReply ? (
            <div className="mt-5 border-t border-border pt-4">
              <AdminActionForm action={replyTicketAdminAction} submitLabel="Send reply">
                <input type="hidden" name="ticketId" value={data.ticket.id} />
                <Textarea name="body" required rows={4} placeholder="Reply to the customer…" />
                <label className="mt-2 flex items-center gap-2 text-[11px] text-fg-soft">
                  <input type="checkbox" name="internal" className="accent-[var(--primary)]" />
                  Internal note (not delivered to the customer)
                </label>
              </AdminActionForm>
            </div>
          ) : null}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Ticket state</h2>
            <form action={setTicketStatusFormAction} className="mt-3 space-y-2">
              <input type="hidden" name="ticketId" value={data.ticket.id} />
              <select name="status" defaultValue={data.ticket.status} className="focus-ring h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs">
                <option value="open">Open</option>
                <option value="pending">Pending customer</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <button type="submit" className="focus-ring h-9 w-full rounded-xl bg-primary text-xs font-semibold text-primary-fg">
                Update status
              </button>
            </form>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Customer</h2>
            <p className="mt-2 text-xs font-medium text-fg">{data.ticket.display_name}</p>
            <p className="text-[11px] text-muted">{data.ticket.email}</p>
            <Link href={`/admin/customers/${data.ticket.user_id}`} className="mt-3 inline-block text-[11px] font-semibold text-primary hover:underline">
              Open customer record →
            </Link>
          </Card>

          <Card className="p-5 text-[11px] text-muted">
            <p className="font-semibold text-fg">Safety reminder</p>
            <p className="mt-1">Never ask customers for their password, OTP or full card numbers. Use the payment reference for verification.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
