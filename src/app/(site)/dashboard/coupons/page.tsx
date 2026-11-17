import Link from "next/link";
import { TicketPercent } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { many } from "@/lib/db";
import { formatTHB } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Badge, buttonClass, Card, EmptyState, StatusPill } from "@/components/ui";
import { CopyButton } from "@/components/pay-client";

export const metadata = { title: "Coupons" };

export default async function CouponsPage() {
  const user = await requireUser("/dashboard/coupons");
  const [coupons, redemptions] = await Promise.all([
    many<{
      id: string;
      code: string;
      description: string | null;
      type: string;
      value: string;
      min_order: string;
      max_discount: string | null;
      expires_at: string | null;
      usage_limit: number | null;
      used_count: number;
      per_user_limit: number;
      first_purchase_only: boolean;
    }>(
      `select id, code, description, type, value, min_order, max_discount, expires_at, usage_limit, used_count,
              per_user_limit, first_purchase_only
       from coupons where is_active and (starts_at is null or starts_at <= now())
         and (expires_at is null or expires_at > now())
       order by created_at desc limit 50`,
    ),
    many<{ coupon_id: string; count: number }>(
      "select coupon_id, count(*)::int as count from coupon_redemptions where user_id = $1 group by coupon_id",
      [user.id],
    ),
  ]);
  const used = new Map(redemptions.map((row) => [row.coupon_id, Number(row.count)]));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Offers</p>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">Coupons</h1>
        <p className="mt-1 text-sm text-muted">Apply a code at checkout. Every code is validated server-side.</p>
      </div>

      {coupons.length === 0 ? (
        <EmptyState
          icon={<TicketPercent className="size-5" />}
          title="No active coupons right now"
          description="Follow our announcements to catch the next drop."
          action={<Link href="/products" className={buttonClass({ size: "sm" })}>Browse products</Link>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {coupons.map((coupon) => {
            const remaining = coupon.usage_limit ? Math.max(0, coupon.usage_limit - coupon.used_count) : null;
            const userUsed = used.get(coupon.id) ?? 0;
            const exhausted = remaining === 0 || userUsed >= coupon.per_user_limit;
            return (
              <Card key={coupon.id} className={`overflow-hidden ${exhausted ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-4 border-b border-border bg-surface-2/50 p-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {coupon.type === "percentage" ? `${Number(coupon.value)}% off` : `${formatTHB(coupon.value)} off`}
                    </p>
                    <p className="mt-1 font-mono text-xl font-bold tracking-wide text-fg">{coupon.code}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={exhausted ? "neutral" : "success"}>{exhausted ? "Used" : "Active"}</Badge>
                    <CopyButton value={coupon.code} label="Copy code" />
                  </div>
                </div>
                <div className="p-4 text-xs text-muted">
                  {coupon.description ? <p className="text-fg-soft">{coupon.description}</p> : null}
                  <ul className="mt-2 space-y-1">
                    <li>Minimum order: {formatTHB(coupon.min_order)}</li>
                    {coupon.max_discount ? <li>Maximum discount: {formatTHB(coupon.max_discount)}</li> : null}
                    {coupon.expires_at ? <li>Expires: {formatDate(coupon.expires_at, true)}</li> : null}
                    <li>Limit: {coupon.per_user_limit} use(s) per customer</li>
                    {coupon.first_purchase_only ? <li className="text-warning">First purchase only</li> : null}
                  </ul>
                  {exhausted ? <p className="mt-2 text-[11px] font-medium text-danger">You have reached the usage limit for this coupon.</p> : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
