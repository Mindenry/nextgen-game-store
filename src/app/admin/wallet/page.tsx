import Link from "next/link";
import { Wallet } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { many } from "@/lib/db";
import { formatTHB } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Alert, Card, Input, Table, Td, Th } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import { adjustWalletAction } from "@/actions/admin-finance";

export const metadata = { title: "Wallets" };

export default async function AdminWalletPage() {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.walletAdjust)) return <AccessDenied permission={PERMISSIONS.walletAdjust} />;

  const [wallets, ledger, drift] = await Promise.all([
    many<{
      user_id: string;
      email: string;
      display_name: string;
      balance: string;
      updated_at: string;
      tx_count: number;
    }>(
      `select p.id as user_id, p.email, p.display_name, w.balance, w.updated_at,
              (select count(*)::int from wallet_transactions t where t.user_id = p.id) as tx_count
       from wallets w join profiles p on p.id = w.user_id order by w.balance desc limit 200`,
    ),
    many<{
      id: string;
      email: string;
      display_name: string;
      type: string;
      amount: string;
      balance_after: string;
      description: string;
      created_at: string;
    }>(
      `select t.id, p.email, p.display_name, t.type, t.amount, t.balance_after, t.description, t.created_at
       from wallet_transactions t join profiles p on p.id = t.user_id order by t.created_at desc limit 50`,
    ),
    many<{ user_id: string; balance: string; ledger_balance: string; drift: string }>(
      "select user_id, balance, ledger_balance, drift from v_wallet_reconciliation where drift <> 0",
    ),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Wallets"
        description="Balance changes only happen through the ledger. A reconciliation view proves every wallet equals the sum of its transactions."
      />

      {drift.length > 0 ? (
        <Alert variant="danger" className="mb-4" title="Ledger reconciliation mismatch">
          {drift.length} wallet(s) do not match their ledger. Stop adjustments and investigate immediately.
        </Alert>
      ) : (
        <Alert variant="success" className="mb-4">
          Ledger reconciled: every wallet balance equals its completed transactions.
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px] xl:items-start">
        <Card className="p-4">
          <h2 className="text-sm font-semibold">Wallets</h2>
          <Table className="mt-3 min-w-[620px]">
            <thead><tr><Th>Customer</Th><Th>Balance</Th><Th>Entries</Th><Th>Updated</Th><Th /></tr></thead>
            <tbody>
              {wallets.map((wallet) => (
                <tr key={wallet.user_id}>
                  <Td>
                    <p className="text-xs font-semibold text-fg">{wallet.display_name}</p>
                    <p className="text-[10px] text-muted">{wallet.email}</p>
                  </Td>
                  <Td className="tabular text-xs font-semibold">{formatTHB(wallet.balance)}</Td>
                  <Td className="text-xs">{wallet.tx_count}</Td>
                  <Td className="text-[10px]">{formatDate(wallet.updated_at, true)}</Td>
                  <Td>
                    <Link href={`/admin/customers/${wallet.user_id}`} className="text-[10px] font-semibold text-primary hover:underline">
                      Open
                    </Link>
                  </Td>
                </tr>
              ))}
              {wallets.length === 0 ? <tr><Td colSpan={5} className="py-8 text-center text-xs text-muted">No wallets yet.</Td></tr> : null}
            </tbody>
          </Table>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Wallet className="size-4 text-primary" /> Adjust a wallet</h2>
            <p className="mt-1 text-[11px] text-muted">Requires a reason. Creates an admin_credit/admin_debit ledger entry and notifies the customer.</p>
            <div className="mt-3">
              <AdminActionForm action={adjustWalletAction} submitLabel="Apply adjustment" compact>
                <label className="mb-1 block text-[10px] font-semibold text-muted">Customer ID</label>
                <Input name="userId" required placeholder="UUID from customer record" className="!h-9 !text-[11px]" />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select name="direction" className="focus-ring h-9 rounded-xl border border-border bg-surface px-2 text-xs">
                    <option value="credit">Credit (+)</option>
                    <option value="debit">Debit (−)</option>
                  </select>
                  <Input name="amount" required type="number" step="0.01" min="0.01" placeholder="Amount" className="!h-9 !text-xs" />
                </div>
                <Input name="reason" required minLength={5} placeholder="Reason (required)" className="mt-2 !h-9 !text-xs" />
              </AdminActionForm>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Recent ledger entries</h2>
            <ul className="mt-2 divide-y divide-border">
              {ledger.map((entry) => (
                <li key={entry.id} className="py-2 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-fg">{entry.description}</span>
                    <span className={`tabular shrink-0 font-semibold ${Number(entry.amount) >= 0 ? "text-success" : ""}`}>
                      {Number(entry.amount) >= 0 ? "+" : ""}{formatTHB(entry.amount)}
                    </span>
                  </div>
                  <p className="text-[9px] text-muted">{entry.display_name} · {entry.type} · {formatDate(entry.created_at, true)}</p>
                </li>
              ))}
              {ledger.length === 0 ? <li className="py-4 text-xs text-muted">No transactions.</li> : null}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
