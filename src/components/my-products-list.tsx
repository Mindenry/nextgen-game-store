"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, Package } from "lucide-react";
import { toast } from "sonner";
import type { UserProduct } from "@/lib/orders";
import { Badge, StatusPill, buttonClass } from "@/components/ui";
import { formatDate } from "@/lib/utils";

const SECRET_KEYS = ["password", "recovery", "code", "key", "2fa", "backup"];

export function MyProductsList({ products }: { products: UserProduct[] }) {
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <Package className="mx-auto size-5 text-muted" />
        <p className="mt-3 font-semibold">No delivered products yet</p>
        <p className="mt-1 text-sm text-muted">After a purchase is delivered, your credentials and instructions appear here.</p>
      </div>
    );
  }
  return <div className="space-y-3">{products.map((product) => <ProductRow key={`${product.kind}-${product.id}`} product={product} />)}</div>;
}

function ProductRow({ product }: { product: UserProduct }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const delivered = product.status === "delivered" || product.status === "completed";
  const payload = product.payload ? Object.entries(product.payload) : [];

  async function copyAll() {
    if (!product.payload) return;
    const text = Object.entries(product.payload).map(([key, value]) => `${key}: ${value}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Credentials copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard permission denied");
    }
  }

  return (
    <div className="surface-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            {product.kind === "topup" ? <Package className="size-4" /> : <KeyRound className="size-4" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg">{product.productName}</p>
            <p className="text-[11px] text-muted">
              {product.orderNumber} · {product.deliveredAt ? formatDate(product.deliveredAt, true) : "Awaiting delivery"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="outline" className="capitalize">{product.kind === "inventory" ? "account" : product.kind}</Badge>
          <StatusPill status={product.status} />
        </div>
      </div>

      {product.note ? <p className="mt-3 rounded-lg bg-surface-2 p-2.5 text-[11px] text-muted">{product.note}</p> : null}

      {payload.length > 0 ? (
        <div className="mt-3 rounded-xl border border-border bg-surface-2/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              {product.kind === "topup" ? "Player details" : "Delivered credentials"}
            </p>
            {product.kind !== "topup" ? (
              <div className="flex gap-1.5">
                <button type="button" onClick={copyAll} className={buttonClass({ variant: "ghost", size: "sm" })}>
                  {copied ? <Check className="size-3" /> : <Copy className="size-3" />} Copy
                </button>
                <button type="button" onClick={() => setRevealed((value) => !value)} className={buttonClass({ variant: "ghost", size: "sm" })}>
                  {revealed ? <EyeOff className="size-3" /> : <Eye className="size-3" />} {revealed ? "Hide" : "Reveal"}
                </button>
              </div>
            ) : null}
          </div>
          <dl className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2">
            {payload.map(([key, value]) => {
              const isSecret = product.kind !== "topup" && SECRET_KEYS.some((needle) => key.toLowerCase().includes(needle));
              return (
                <div key={key} className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5">
                  <dt className="shrink-0 capitalize text-muted">{key.replaceAll("_", " ")}</dt>
                  <dd className="ml-auto min-w-0 truncate font-mono text-[11px] text-fg">
                    {isSecret && !revealed ? "••••••••" : value}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="mt-2 text-[10px] text-muted">
            Keep these credentials private. Change the password after first login where the product allows it.
          </p>
        </div>
      ) : delivered ? (
        <p className="mt-3 text-[11px] text-muted">Delivered — no credential payload for this item.</p>
      ) : (
        <p className="mt-3 text-[11px] text-muted">Our team is preparing this item.</p>
      )}
    </div>
  );
}
