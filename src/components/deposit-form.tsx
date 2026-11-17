"use client";

import { useActionState, useState } from "react";
import { CreditCard, Loader2, QrCode } from "lucide-react";
import { createDepositAction, type DepositState } from "@/actions/wallet";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { formatTHB } from "@/lib/money";

export function DepositForm({
  min,
  max,
  providers,
}: {
  min: number;
  max: number;
  providers: { id: string; name: string; kind: string }[];
}) {
  const [state, action, pending] = useActionState<DepositState, FormData>(createDepositAction, {});
  const [amount, setAmount] = useState("300");
  const presets = [100, 300, 500, 1000, 2000, 5000];

  return (
    <form action={action} className="space-y-5">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {providers.length === 0 ? (
        <Alert variant="warning" title="No payment provider enabled">
          Enable PromptPay QR or Manual Bank Transfer in Admin → Payment Providers.
        </Alert>
      ) : null}

      <Field label="Amount (THB)" htmlFor="amount" hint={`Minimum ฿${min.toFixed(2)} · Maximum ฿${max.toFixed(2)}`}>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">฿</span>
          <Input
            id="amount"
            name="amount"
            type="number"
            min={min}
            max={max}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="h-12 pl-8 text-lg font-semibold"
            required
          />
        </div>
      </Field>

      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setAmount(String(preset))}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              Number(amount) === preset
                ? "border-primary bg-primary/8 text-primary"
                : "border-border bg-surface text-muted hover:text-fg"
            }`}
          >
            ฿{preset.toLocaleString()}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface-2 p-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">You will receive</p>
        <p className="tabular mt-0.5 text-2xl font-semibold text-fg">{formatTHB(Number(amount) || 0)}</p>
        <p className="mt-0.5 text-[11px] text-muted">Credited to your wallet after payment verification.</p>
      </div>

      {providers.length > 0 ? (
        <Field label="Payment method" htmlFor="providerId">
          <Select id="providerId" name="providerId" defaultValue={providers[0]?.id}>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
                {provider.kind === "promptpay" ? " — QR" : provider.kind === "manual" ? " — bank transfer" : ""}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending || providers.length === 0}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
        {pending ? "Creating payment…" : "Create payment"}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-[10px] text-muted">
        <CreditCard className="size-3" />
        You will see a QR / transfer screen with a unique reference.
      </p>
    </form>
  );
}
