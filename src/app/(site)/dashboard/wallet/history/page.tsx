import Link from "next/link";
import { ArrowLeft, CreditCard } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { many } from "@/lib/db";
import { listWalletTransactions } from "@/lib/wallet";
import { formatTHB } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { buttonClass, Card, StatusPill, Table, Td, Th } from "@/components/ui";

export const metadata = { title: "Top-up history" };

export default async function WalletHistoryPage() {
  const user = await requireUser("/dashboard/wallet/history");
  const [transactions, deposits] = await Promise.all([
    listWalletTransactions(user.id, 100),
    many<{ reference: string; amount: string; status: string; purpose: string; provider_id: string; created_at: string; paid_at: string | null }>(
      "select reference, amount, status, purpose, provider_id, created_at, paid_at from payments where user_id = $1 order by created_at desc limit 100",
      [user.id],
    ),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/wallet" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> Wallet
      </Link>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">History</p>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">Top-up &amp; ledger history</h1>
        <p className="mt-1 text-sm text-muted">A complete, auditable record of every balance movement.</p>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold">Ledger entries</h2>
        <div className="mt-3">
          <Table className="min-w-[760px]">
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Description</Th>
                <Th>Type</Th>
                <Th>Date</Th>
                <Th className="text-right">Amount</Th>
                <Th className="text-right">Balance after</Th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <Td><span className="font-mono text-[10px]">{tx.reference}</span></Td>
                  <Td className="text-xs">{tx.description}</Td>
                  <Td className="text-[11px] capitalize">{tx.type.replaceAll("_", " ")}</Td>
                  <Td className="text-[11px]">{formatDate(tx.created_at, true)}</Td>
                  <Td className={`tabular text-right text-xs font-semibold ${Number(tx.amount) >= 0 ? "text-success" : "text-fg"}`}>
                    {Number(tx.amount) >= 0 ? "+" : ""}{formatTHB(tx.amount)}
                  </Td>
                  <Td className="tabular text-right text-[11px]">{formatTHB(tx.balance_after)}</Td>
                </tr>
              ))}
              {transactions.length === 0 ? (
                <tr><Td colSpan={6} className="py-8 text-center text-xs text-muted">No ledger entries yet.</Td></tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Payments</h2>
          <Link href="/dashboard/wallet/topup" className={buttonClass({ size: "sm", variant: "outline" })}>
            <CreditCard className="size-3.5" /> New deposit
          </Link>
        </div>
        <div className="mt-3">
          <Table className="min-w-[680px]">
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Purpose</Th>
                <Th>Provider</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((payment) => (
                <tr key={payment.reference}>
                  <Td>
                    <Link href={`/pay/${payment.reference}`} className="font-mono text-[10px] text-primary hover:underline">
                      {payment.reference}
                    </Link>
                  </Td>
                  <Td className="text-[11px] capitalize">{payment.purpose.replace("_", " ")}</Td>
                  <Td className="text-[11px]">{payment.provider_id}</Td>
                  <Td><StatusPill status={payment.status} /></Td>
                  <Td className="text-[11px]">{formatDate(payment.created_at, true)}</Td>
                  <Td className="tabular text-right text-xs font-semibold">{formatTHB(payment.amount)}</Td>
                </tr>
              ))}
              {deposits.length === 0 ? (
                <tr><Td colSpan={6} className="py-8 text-center text-xs text-muted">No payments yet.</Td></tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
