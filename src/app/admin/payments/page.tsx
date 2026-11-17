import Link from "next/link";
import { Check, Clock, ExternalLink, Search, X } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { listPayments, listWebhookEvents } from "@/lib/admin";
import { getFileUrl } from "@/lib/uploads";
import { formatTHB } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Badge, buttonClass, Card, Input, Pagination, Select, StatusPill, Table, Td, Th } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import { AdminActionButton } from "@/components/admin/admin-action-button";
import { approvePaymentAction, rejectPaymentAction, expirePaymentsAction } from "@/actions/admin-finance";

export const metadata = { title: "Payments" };

const STATUSES = ["", "PENDING", "VERIFYING", "MANUAL_REVIEW", "PAID", "EXPIRED", "REJECTED", "FAILED", "REFUNDED"];

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.paymentsView)) return <AccessDenied permission={PERMISSIONS.paymentsView} />;
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);
  const [result, events] = await Promise.all([
    listPayments({ q, status: status || undefined, page }),
    listWebhookEvents(20),
  ]);
  const canVerify = can(user, PERMISSIONS.paymentsVerify);
  const reviewRows = await Promise.all(
    result.rows
      .filter((row) => row.status === "MANUAL_REVIEW")
      .map(async (row) => ({ ...row, evidenceUrl: row.evidence_url ? await getFileUrl(row.evidence_url) : null })),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Payments"
        description="Verify deposits and order payments, inspect evidence, and audit webhook traffic. Amounts are always compared server-side."
        actions={
          <>
            <AdminActionButton
              action={expirePaymentsAction}
              label="Expire stale payments"
              icon={<Clock className="size-3.5" />}
              confirmText="Mark all PENDING/VERIFYING payments past their expiry as EXPIRED and cancel unpaid orders?"
            />
            <Link href="/admin/payment-providers" className={buttonClass({ variant: "outline", size: "sm" })}>
              Providers
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Awaiting payment", value: result.totals?.pending ?? 0, tone: "warning" as const },
          { label: "Manual review", value: result.totals?.review ?? 0, tone: "primary" as const },
          { label: "Verified today", value: formatTHB(result.totals?.paid_today ?? "0"), tone: "success" as const },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{item.label}</p>
            <p className="tabular mt-1.5 text-lg font-semibold text-fg">{item.value}</p>
          </Card>
        ))}
      </div>

      {reviewRows.length > 0 ? (
        <Card className="mt-4 border-warning/30 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Slips awaiting review</h2>
            <Badge tone="warning">{reviewRows.length}</Badge>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {reviewRows.map((row) => (
              <div key={row.id} className="rounded-xl border border-border bg-surface-2/50 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] font-semibold text-fg">{row.reference}</p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {row.display_name} · {row.email} · {row.purpose.replace("_", " ")}
                    </p>
                  </div>
                  <p className="tabular text-sm font-semibold">{formatTHB(row.amount)}</p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                  {row.order_number ? <Badge tone="outline">{row.order_number}</Badge> : null}
                  <span className="text-muted">{formatDate(row.created_at, true)}</span>
                  {row.evidenceUrl ? (
                    <a href={row.evidenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                      <ExternalLink className="size-3" /> View slip
                    </a>
                  ) : (
                    <span className="text-danger">No evidence attached</span>
                  )}
                </div>
                {canVerify ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <AdminActionForm action={approvePaymentAction} submitLabel="Approve" submitVariant="success" compact>
                      <input type="hidden" name="paymentId" value={row.id} />
                      <Input name="note" placeholder="Verification note" className="!h-8 !text-[11px]" />
                    </AdminActionForm>
                    <AdminActionForm action={rejectPaymentAction} submitLabel="Reject" submitVariant="danger" compact>
                      <input type="hidden" name="paymentId" value={row.id} />
                      <Input name="note" required placeholder="Rejection reason" className="!h-8 !text-[11px]" />
                    </AdminActionForm>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-muted">
            Approve only after confirming the amount, destination account and reference against the bank statement.
          </p>
        </Card>
      ) : null}

      <Card className="mt-4 p-3.5">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
            <Input name="q" defaultValue={q} placeholder="Reference, email or order number…" className="pl-8" />
          </div>
          <Select name="status" defaultValue={status} className="w-auto">
            {STATUSES.map((option) => <option key={option} value={option}>{option || "All statuses"}</option>)}
          </Select>
          <button type="submit" className={buttonClass({ size: "md" })}>Filter</button>
        </form>
      </Card>

      <Card className="mt-4 p-4">
        <Table className="min-w-[900px]">
          <thead>
            <tr><Th>Reference</Th><Th>Customer</Th><Th>Purpose</Th><Th>Provider</Th><Th>Status</Th><Th>Created</Th><Th>Verified</Th><Th className="text-right">Amount</Th></tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.id}>
                <Td>
                  <Link href={`/pay/${row.reference}`} className="font-mono text-[10px] font-semibold text-fg hover:text-primary">
                    {row.reference}
                  </Link>
                  {row.order_number ? <p className="mt-0.5 text-[9px] text-muted">{row.order_number}</p> : null}
                </Td>
                <Td>
                  <p className="text-[11px] text-fg">{row.display_name}</p>
                  <p className="text-[9px] text-muted">{row.email}</p>
                </Td>
                <Td className="text-[10px] capitalize">{row.purpose.replace("_", " ")}</Td>
                <Td className="text-[10px]">{row.provider_id}</Td>
                <Td><StatusPill status={row.status} /></Td>
                <Td className="text-[9px]">{formatDate(row.created_at, true)}</Td>
                <Td className="text-[9px]">
                  {row.verification_source ? <span className="capitalize">{row.verification_source}</span> : "—"}
                  {row.reviewed_at ? <p className="text-muted">{formatDate(row.reviewed_at)}</p> : null}
                </Td>
                <Td className="tabular text-right text-xs font-semibold">{formatTHB(row.amount)}</Td>
              </tr>
            ))}
            {result.rows.length === 0 ? <tr><Td colSpan={8} className="py-10 text-center text-xs text-muted">No payments found.</Td></tr> : null}
          </tbody>
        </Table>
      </Card>

      <Pagination
        page={result.page}
        pages={Math.max(1, Math.ceil(result.total / result.pageSize))}
        makeHref={(nextPage) => `/admin/payments?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(nextPage) }).toString()}`}
      />

      <Card className="mt-4 p-5">
        <h2 className="text-sm font-semibold">Webhook events</h2>
        <p className="mt-1 text-[11px] text-muted">Signature failures are recorded here and never credited.</p>
        <div className="mt-3">
          <Table className="min-w-[700px]">
            <thead><tr><Th>Time</Th><Th>Provider</Th><Th>Event</Th><Th>Reference</Th><Th>Signature</Th><Th>IP</Th></tr></thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <Td className="text-[10px]">{formatDate(event.created_at, true)}</Td>
                  <Td className="text-[10px]">{event.provider_id}</Td>
                  <Td className="text-[10px]">{event.event_type}</Td>
                  <Td className="font-mono text-[9px]">{event.reference ?? event.provider_ref ?? "—"}</Td>
                  <Td>
                    <Badge tone={event.signature_valid ? "success" : "danger"}>
                      {event.signature_valid ? <Check className="size-3" /> : <X className="size-3" />}
                      {event.signature_valid ? "valid" : "invalid"}
                    </Badge>
                  </Td>
                  <Td className="text-[9px]">{event.ip ?? "—"}</Td>
                </tr>
              ))}
              {events.length === 0 ? <tr><Td colSpan={6} className="py-6 text-center text-xs text-muted">No webhook events received.</Td></tr> : null}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
