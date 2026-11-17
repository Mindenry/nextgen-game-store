import Link from "next/link";
import { ArrowLeft, Info, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { many } from "@/lib/db";
import { getWallet } from "@/lib/wallet";
import { getPromptPayConfig } from "@/lib/settings";
import { formatTHB } from "@/lib/money";
import { Alert, Card } from "@/components/ui";
import { DepositForm } from "@/components/deposit-form";

export const metadata = { title: "Top up wallet" };

export default async function WalletTopupPage() {
  const user = await requireUser("/dashboard/wallet/topup");
  const [wallet, promptConfig] = await Promise.all([
    getWallet(user.id),
    getPromptPayConfig(),
  ]);
  const providers = await many<{ id: string; name: string; kind: string }>(
    "select id, name, kind from payment_providers where is_enabled order by sort_order",
  );

  return (
    <div className="space-y-6">
      <Link href="/dashboard/wallet" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> Wallet
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Add funds</p>
          <h1 className="mt-1 text-2xl font-semibold md:text-3xl">Top up your wallet</h1>
          <p className="mt-1 text-sm text-muted">Balance: <span className="font-semibold text-fg">{formatTHB(wallet.balance)}</span></p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[420px_1fr] lg:items-start">
        <Card className="p-5">
          <DepositForm min={promptConfig.minDeposit} max={promptConfig.maxDeposit} providers={providers} />
        </Card>

        <div className="space-y-4">
          {!promptConfig.promptPayId ? (
            <Alert variant="warning" title="PromptPay ID is not configured">
              The store owner must add a PromptPay ID in Admin → Settings. Manual bank transfer can still be used if
              configured.
            </Alert>
          ) : null}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-success" /> How wallet top-ups work
            </h2>
            <ol className="mt-3 space-y-3 text-xs leading-relaxed text-muted">
              <li><span className="font-semibold text-fg">1.</span> Choose an amount and create a payment. The server assigns a unique reference.</li>
              <li><span className="font-semibold text-fg">2.</span> Scan the PromptPay QR and transfer the exact amount, or use the bank details shown.</li>
              <li><span className="font-semibold text-fg">3.</span> If a provider webhook is connected, payment is confirmed automatically. Otherwise upload your slip for staff review.</li>
              <li><span className="font-semibold text-fg">4.</span> Your balance is credited only after verification, with a ledger entry you can audit.</li>
            </ol>
          </Card>
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Info className="size-4 text-primary" /> Payment safety
            </h2>
            <ul className="mt-3 space-y-2 text-xs text-muted">
              <li>• Every payment reference is single-use and amount-locked.</li>
              <li>• Duplicate webhooks and duplicate approvals cannot double-credit a wallet.</li>
              <li>• A slip alone never marks a payment as successful.</li>
              <li>• Wallet balances can never go below zero.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
