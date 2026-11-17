import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Landmark, RefreshCw, ShieldAlert } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { many, one, type Row } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatTHB } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import {
  importStatementAction,
  matchBankTransactionAction,
  runAutoMatchAction,
  saveBankSettingsAction,
} from "@/actions/admin-bank";
import { Alert, Badge, Card, Input, Select, Stat, Table, Td, Th } from "@/components/ui";

export const metadata = { title: "Bank reconciliation" };

interface BankTxRow extends Row {
  id: string;
  source: string;
  bank: string | null;
  external_id: string;
  amount: string;
  occurred_at: string;
  description: string | null;
  counterparty: string | null;
  slip_reference: string | null;
  raw: string | null;
}

interface OpenPaymentRow extends Row {
  id: string;
  reference: string;
  amount: string;
  purpose: string;
  status: string;
  user_email: string;
  created_at: string;
}

interface MatchedRow extends BankTxRow {
  payment_reference: string | null;
  match_method: string | null;
  matched_at: string | null;
}

export default async function BankReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ matched?: string }>;
}) {
  const user = await requireStaff("/admin");
  const { matched: matchedFlash } = await searchParams;
  if (!can(user, PERMISSIONS.paymentsView) && !can(user, PERMISSIONS.settingsManage)) {
    return <AccessDenied permission={PERMISSIONS.paymentsView} />;
  }

  const [settings, unmatched, openPayments, matched, totals] = await Promise.all([
    getSettings(),
    many<BankTxRow>(
      `select id, source, bank, external_id, amount, occurred_at, description, counterparty, slip_reference, raw
         from bank_transactions
        where payment_id is null and direction = 'credit'
        order by occurred_at desc
        limit 50`,
    ),
    many<OpenPaymentRow>(
      `select p.id, p.reference, p.amount, p.purpose, p.status, pr.email as user_email, p.created_at
         from payments p join profiles pr on pr.id = p.user_id
        where p.status in ('PENDING','VERIFYING','MANUAL_REVIEW')
          and p.created_at > now() - interval '14 days'
        order by p.created_at desc
        limit 200`,
    ),
    many<MatchedRow>(
      `select bt.id, bt.source, bt.bank, bt.external_id, bt.amount, bt.occurred_at, bt.description,
              bt.counterparty, bt.slip_reference, bt.raw, bt.match_method, bt.matched_at,
              p.reference as payment_reference
         from bank_transactions bt left join payments p on p.id = bt.payment_id
        where bt.payment_id is not null
        order by bt.matched_at desc nulls last
        limit 25`,
    ),
    one<{ credits: number; unmatched: number; matched_today: number; latest_import: string | null }>(
      `select
         (select count(*)::int from bank_transactions where direction = 'credit') as credits,
         (select count(*)::int from bank_transactions where payment_id is null and direction = 'credit') as unmatched,
         (select count(*)::int from bank_transactions where matched_at > now() - interval '24 hours') as matched_today,
         (select max(created_at)::text from bank_statement_imports) as latest_import`,
    ),
  ]);

  const windowMinutes = Number(settings["bank.match_window_minutes"] ?? 1440);
  const candidatesFor = (amount: string) =>
    openPayments.filter((payment) => Number(payment.amount) === Number(amount));

  return (
    <div>
      <PageHeader
        eyebrow="Payments"
        title="Bank reconciliation"
        description="ตรวจเงินเข้าจริงจาก statement ธนาคารของร้าน แล้วให้ระบบเครดิตเฉพาะรายการที่มียอดเงินเข้าจริงเท่านั้น (สลิปอย่างเดียวไม่ถือว่ายืนยัน)"
      />

      {matchedFlash === "1" ? (
        <Alert variant="success" className="mb-4">
          Payment verified against the bank credit and credited to the customer&apos;s wallet.
        </Alert>
      ) : null}

      <Alert variant="info" className="mb-4">
        <p className="text-[11px] leading-relaxed">
          วิธีทำงาน: export statement จากแอปธนาคารเป็น CSV → อัปโหลดที่นี่ → ระบบจับคู่ “เงินเข้า” กับรายการที่ลูกค้าค้างชำระด้วย{" "}
          <strong>ยอดเงิน + เวลา{windowMinutes >= 60 ? ` ±${Math.round(windowMinutes / 60)} ชม.` : ` ±${windowMinutes} นาที`}</strong>
          {", "}และถ้าในรายละเอียดมีเลขอ้างอิง <span className="font-mono">NG…</span> จะจับคู่แม่นขึ้น ถ้ามีหลายรายการยอดเดียวกัน ระบบจะไม่เดา ให้เลือกเองด้านล่าง
        </p>
      </Alert>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Incoming credits" value={String(totals?.credits ?? 0)} hint="เงินเข้าที่นำเข้าระบบ" />
        <Stat label="Unmatched" value={String(totals?.unmatched ?? 0)} hint="ยังไม่จับคู่รายการ" />
        <Stat label="Matched (24h)" value={String(totals?.matched_today ?? 0)} hint="ยืนยันและเครดิตแล้ว" />
        <Stat
          label="Latest import"
          value={totals?.latest_import ? formatDate(totals.latest_import, true) : "—"}
          hint="เวลานำเข้า statement ล่าสุด"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Landmark className="size-4 text-primary" /> Import bank statement
          </h2>
          <p className="mt-1 text-[11px] text-muted">
            รองรับ CSV/TSV ที่มีคอลัมน์วันที่ ยอดเงิน และรายละเอียด (หัวตารางไทยหรืออังกฤษ) จาก KBank, SCB, BBL, KTB, GSB, TTB
            หรือไฟล์ที่ export จากแอปธนาคาร
          </p>
          <AdminActionForm action={importStatementAction} submitLabel="Import & match" className="mt-3">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-fg-soft">ธนาคาร</label>
                <Select name="bank" defaultValue="kbank">
                  <option value="kbank">KBank</option>
                  <option value="scb">SCB</option>
                  <option value="bbl">Bangkok Bank</option>
                  <option value="ktb">Krungthai</option>
                  <option value="gsb">GSB</option>
                  <option value="ttb">TTB</option>
                  <option value="truemoney">TrueMoney Wallet</option>
                  <option value="generic">อื่น ๆ / Generic</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-fg-soft">ไฟล์ statement (CSV)</label>
                <Input type="file" name="statement" accept=".csv,.tsv,.txt" required />
                <p className="mt-1 text-[10px] text-muted">
                  ไฟล์จะถูกอ่านบนเซิร์ฟเวอร์ของคุณเท่านั้น ไม่ส่งออกไปที่ใด · ไม่เกิน 3 MB
                </p>
              </div>
            </div>
          </AdminActionForm>

          <div className="mt-4 border-t border-border pt-4">
            <AdminActionForm action={runAutoMatchAction} submitLabel="จับคู่อีกครั้ง" submitVariant="secondary" compact>
              <p className="text-[11px] text-muted">
                รันซ้ำกับเคลมที่ยังไม่จับคู่ หลังมีรายการชำระเงินใหม่เข้ามา
              </p>
            </AdminActionForm>
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <AdminActionForm action={saveBankSettingsAction} submitLabel="บันทึกการตั้งค่าจับคู่" submitVariant="outline" compact>
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-[11px] text-fg-soft">
                  <input
                    type="checkbox"
                    name="autoMatch"
                    defaultChecked={settings["bank.auto_match_enabled"] !== false}
                    className="mt-0.5 accent-[var(--primary)]"
                  />
                  <span>จับคู่อัตโนมัติเมื่อยอดเงินตรงและมีผู้สมัครเพียงรายการเดียว</span>
                </label>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-fg-soft">
                    ช่วงเวลาที่ยอมรับ (นาที)
                  </label>
                  <Input type="number" name="windowMinutes" min={5} max={20160} defaultValue={windowMinutes} />
                  <p className="mt-1 text-[10px] text-muted">
                    เงินเข้าต้องอยู่ห่างจากเวลาสร้างรายการไม่เกินค่านี้ (1440 = 24 ชั่วโมง)
                  </p>
                </div>
              </div>
            </AdminActionForm>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="size-4 text-success" /> Recently matched
          </h2>
          <p className="mt-1 text-[11px] text-muted">รายการที่ระบบยืนยันจากเงินเข้าจริงและเครดิตให้ลูกค้าแล้ว</p>
          <div className="mt-3 overflow-x-auto">
            {matched.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-[11px] text-muted">
                ยังไม่มีการจับคู่ — อัปโหลด statement เพื่อเริ่ม
              </p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Payment</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Method</Th>
                    <Th>Matched</Th>
                  </tr>
                </thead>
                <tbody>
                  {matched.map((row) => (
                    <tr key={row.id}>
                      <Td>
                        {row.payment_reference ? (
                          <Link
                            href={`/admin/payments?q=${encodeURIComponent(row.payment_reference)}`}
                            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-primary hover:underline"
                          >
                            {row.payment_reference} <ArrowUpRight className="size-3" />
                          </Link>
                        ) : (
                          <span className="text-[11px] text-muted">—</span>
                        )}
                      </Td>
                      <Td className="text-right text-xs font-semibold">{formatTHB(row.amount)}</Td>
                      <Td>
                        <Badge tone={row.match_method === "reference" ? "success" : "primary"} className="text-[9px]">
                          {row.match_method ?? "auto"}
                        </Badge>
                      </Td>
                      <Td className="text-[11px] text-muted">
                        {row.matched_at ? formatDate(row.matched_at, true) : "—"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="size-4 text-warning" /> Unmatched incoming credits
        </h2>
        <p className="mt-1 text-[11px] text-muted">
          เงินเข้าที่ระบบยังไม่กล้ายืนยัน (ยอดซ้ำกันหลายรายการ หรือไม่มีรายการค้างชำระที่ตรงยอด) — เลือกรายการที่ถูกต้องแล้วกดยืนยัน
        </p>

        {unmatched.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
            ไม่มีเงินเข้าที่ค้างจับคู่ — ทุกอย่างเรียบร้อย
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {unmatched.map((tx) => {
              const candidates = candidatesFor(tx.amount);
              return (
                <div key={tx.id} data-bank-ref={tx.external_id} className="rounded-xl border border-border bg-surface-2/40 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-fg">
                        {formatTHB(tx.amount)}{" "}
                        <span className="text-[10px] font-normal text-muted">· {tx.bank ?? "bank"}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {formatDate(tx.occurred_at, true)} · {tx.description ?? tx.counterparty ?? "no description"}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted">ref {tx.external_id}</p>
                    </div>
                    <Badge tone="warning" className="text-[9px]">
                      {candidates.length} candidate{candidates.length === 1 ? "" : "s"}
                    </Badge>
                  </div>

                  {candidates.length === 0 ? (
                    <p className="mt-2 rounded-lg bg-warning/8 px-3 py-2 text-[11px] text-warning">
                      ไม่มีรายการค้างชำระยอดนี้ — อาจเป็นเงินเข้าอื่นหรือลูกค้าจ่ายผิดยอด ตรวจในหน้า Payments
                    </p>
                  ) : (
                    <AdminActionForm
                      action={matchBankTransactionAction}
                      submitLabel="ยืนยันรายการนี้"
                      submitVariant="secondary"
                      compact
                      className="mt-2"
                    >
                      <input type="hidden" name="transactionId" value={tx.id} />
                      <Select name="paymentId" required defaultValue={candidates[0].id}>
                        {candidates.map((payment) => (
                          <option key={payment.id} value={payment.id}>
                            {payment.reference} · {payment.user_email} · {formatTHB(payment.amount)} ·{" "}
                            {formatDate(payment.created_at, true)}
                          </option>
                        ))}
                      </Select>
                    </AdminActionForm>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <RefreshCw className="size-4 text-muted" /> Open payments waiting for money
        </h2>
        <div className="mt-3 overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Customer</Th>
                <Th className="text-right">Amount</Th>
                <Th>Status</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {openPayments.slice(0, 20).map((payment) => (
                <tr key={payment.id}>
                  <Td className="font-mono text-[11px]">{payment.reference}</Td>
                  <Td className="text-[11px]">{payment.user_email}</Td>
                  <Td className="text-right text-xs font-semibold">{formatTHB(payment.amount)}</Td>
                  <Td>
                    <Badge tone={payment.status === "MANUAL_REVIEW" ? "warning" : "neutral"} className="text-[9px]">
                      {payment.status}
                    </Badge>
                  </Td>
                  <Td className="text-[11px] text-muted">{formatDate(payment.created_at, true)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
