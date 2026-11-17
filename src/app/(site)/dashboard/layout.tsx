import Link from "next/link";
import { LogOut, Shield } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/actions/auth";
import { getWallet } from "@/lib/wallet";
import { one } from "@/lib/db";
import { formatTHB } from "@/lib/money";
import { DashboardNav } from "@/components/dashboard-nav";
import { Badge, buttonClass } from "@/components/ui";
import { initials } from "@/lib/utils";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/dashboard");
  const [wallet, unreadRow] = await Promise.all([
    getWallet(user.id),
    one<{ count: number }>(
      "select count(*)::int as count from notifications where user_id = $1 and read_at is null",
      [user.id],
    ),
  ]);
  const unread = Number(unreadRow?.count ?? 0);

  return (
    <div className="container-page py-8">
      <div className="grid gap-7 lg:grid-cols-[240px_1fr] lg:items-start">
        <aside className="lg:sticky lg:top-24">
          <div className="surface-card p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary">
                {user.avatarUrl ? (
                   
                  <img src={user.avatarUrl} alt="" className="size-full object-cover" />
                ) : (
                  initials(user.displayName || user.email)
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-fg">{user.displayName}</p>
                <p className="truncate text-[11px] text-muted">{user.email}</p>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-surface-2 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Wallet balance</p>
              <p className="tabular mt-0.5 text-lg font-semibold text-fg">{formatTHB(wallet.balance)}</p>
              <Link href="/dashboard/wallet/topup" className={buttonClass({ size: "sm", className: "mt-2 w-full" })}>
                Add funds
              </Link>
            </div>
            {user.roleId !== "customer" ? (
              <Link href="/admin" className="mt-3 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/6 px-3 py-2 text-xs font-semibold text-primary">
                <Shield className="size-3.5" /> Admin dashboard
              </Link>
            ) : null}
            {!user.emailVerified ? (
              <Badge tone="warning" className="mt-3 w-full justify-center">Email not verified</Badge>
            ) : null}
          </div>

          <div className="mt-3 lg:surface-card lg:p-2">
            <DashboardNav unread={unread} />
          </div>

          <form action={logoutAction} className="mt-3 hidden lg:block">
            <button type="submit" className={buttonClass({ variant: "ghost", size: "sm", className: "w-full !justify-start" })}>
              <LogOut className="size-3.5" /> Sign out
            </button>
          </form>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
