import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, CreditCard, ReceiptText, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getWallet, listWalletTransactions, walletStats } from "@/lib/wallet";
import { many } from "@/lib/db";
import { getPromptPayConfig, getEnabledProvider, getSettings } from "@/lib/settings";
import { formatTHB } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { buttonClass, Card, EmptyState, Stat, StatusPill, Table, Td, Th } from "@/components/ui";
import { DepositForm } from "@/components/deposit-form";

export const metadata = { title: "My wallet" };

export default async function WalletPage() {
  const user = await requireUser("/dashboard/wallet");
  const [wallet, stats, transactions, deposits, settings, promptConfig] = await Promise.all([
    getWallet(user.id),
    walletStats(user.id),
    listWalletTransactions(user.id, 20),
    many<{ reference: string; amount: string; status: string; created_at: string; provider_id: string }>(
      "select reference, amount, status, created_at, provider_id from payments where user_id = $1 and purpose = 'wallet_deposit' order by created_at desc limit 10",
      [user.id],
    ),
    getSettings(),
    getPromptPayConfig(),
  ]);
  const activeProvider = await getEnabledProvider(String(settings["payment.active_provider"] ?? "promptpay_qr"));
  const providers = [
    activeProvider && activeProvider.is_enabled
      ? { id: activeProvider.id, name: activeProvider.name, kind: activeProvider.kind }
      : null,
    { id: "manual", name: "Manual Bank Transfer", kind: "manual" },
  ].filter((value, index, self) => value && self.findIndex((item) => item?.id === value.id) === index) as {
    id: string;
    name: string;
    kind: string;
  }[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Wallet</p>
          <h1 className="mt-1 text-2xl font-semibold md:text-3xl">My wallet</h1>
          <p className="mt-1 text-sm text-muted">Every balance change is recorded in an auditable ledger.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/wallet/topup" className={buttonClass({ size: "sm" })}>
            <CreditCard className="size-3.5" /> Add funds
          </Link>
          <Link href="/dashboard/wallet/history" className={buttonClass({ variant: "outline", size: "sm" })}>
            Full history
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.15fr_1fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-fg p-5 text-bg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,color-mix(in_srgb,var(--primary)_60%,transparent),transparent_55%)] opacity-70" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">Available balance</p>
              <Wallet className="size-4 opacity-70" />
            </div>
            <p className="tabular mt-3 text-3xl font-semibold">{formatTHB(wallet.balance)}</p>
            <p className="mt-1 text-[11px] opacity-60">THB · Updated {wallet.updatedAt ? formatDate(wallet.updatedAt, true) : "—"}</p>
            <div className="mt-4 flex gap-2">
              <Link href="/dashboard/wallet/topup" className="rounded-lg bg-bg px-3 py-1.5 text-[11px] font-bold text-fg">
                Top up
              </Link>
              <Link href="/products" className="rounded-lg border border-white/20 px-3 py-1.5 text-[11px] font-semibold text-bg">
                Spend
              </Link>
            </div>
          </div>
        </div>
        <Stat label="Total deposited" value={formatTHB(stats.totalDeposits)} icon={<ArrowDownLeft className="size-4" />} tone="success" hint="Completed top-ups" />
        <Stat label="Total spent" value={formatTHB(stats.totalSpent)} icon={<ArrowUpRight className="size-4" />} hint={`${stats.pendingDeposits} pending deposit(s)`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent ledger entries</h2>
            <Link href="/dashboard/wallet/history" className="text-[11px] font-semibold text-primary hover:underline">View all</Link>
          </div>
          {transactions.length === 0 ? (
            <EmptyState className="mt-4 !border-0" icon={<ReceiptText className="size-5" />} title="No transactions yet" />
          ) : (
            <div className="mt-3">
              <Table className="min-w-[560px]">
                <thead>
                  <tr>
                    <Th>Description</Th>
                    <Th>Type</Th>
                    <Th>Date</Th>
                    <Th className="text-right">Amount</Th>
                    <Th className="text-right">Balance</Th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <Td>
                        <p className="text-xs font-medium text-fg">{tx.description}</p>
                        <p className="font-mono text-[10px] text-muted">{tx.reference}</p>
                      </Td>
                      <Td className="text-[11px] capitalize">{tx.type.replaceAll("_", " ")}</Td>
                      <Td className="text-[11px]">{formatDate(tx.created_at, true)}</Td>
                      <Td className={`tabular text-right text-xs font-semibold ${Number(tx.amount) >= 0 ? "text-success" : "text-fg"}`}>
                        {Number(tx.amount) >= 0 ? "+" : ""}{formatTHB(tx.amount)}
                      </Td>
                      <Td className="tabular text-right text-[11px]">{formatTHB(tx.balance_after)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Add funds</h2>
            <p className="mt-1 text-[11px] text-muted">Funds are credited only after payment verification.</p>
            <div className="mt-4">
              <DepositForm
                min={promptConfig.minDeposit}
                max={promptConfig.maxDeposit}
                providers={providers}
              />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Recent deposits</h2>
            {deposits.length === 0 ? (
              <p className="mt-2 text-xs text-muted">No deposits yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {deposits.map((deposit) => (
                  <li key={deposit.reference} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <Link href={`/pay/${deposit.reference}`} className="block truncate font-mono text-[10px] text-fg hover:text-primary">
                        {deposit.reference}
                      </Link>
                      <p className="text-[10px] text-muted">{formatDate(deposit.created_at, true)}</p>
                    </div>
                    <div className="text-right">
                      <p className="tabular text-xs font-semibold">{formatTHB(deposit.amount)}</p>
                      <StatusPill status={deposit.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
