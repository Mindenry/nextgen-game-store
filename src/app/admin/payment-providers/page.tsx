import { Copy, ShieldCheck } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { listPaymentProviders } from "@/lib/admin";
import { env, setupStatus } from "@/lib/env";
import { Badge, Card, Input, Textarea } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import { saveProviderAction } from "@/actions/admin-finance";

export const metadata = { title: "Payment providers" };

export default async function PaymentProvidersPage() {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.paymentsProviders)) return <AccessDenied permission={PERMISSIONS.paymentsProviders} />;
  const providers = await listPaymentProviders();
  const webhookBase = `${env.appUrl}/api/webhooks/payments`;

  return (
    <div>
      <PageHeader
        eyebrow="Payments"
        title="Payment providers"
        description="Enable the channels you actually operate. Secrets are encrypted with AES-256-GCM and never rendered back to the browser."
      />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {[
          { label: "Database", value: setupStatus.database },
          { label: "Encryption key", value: setupStatus.encryptionConfigured ? "configured" : "missing" },
          { label: "Webhook secret", value: env.webhookSecret ? "configured" : "not set" },
        ].map((item) => (
          <Card key={item.label} className="p-3.5">
            <p className="text-[10px] uppercase tracking-wide text-muted">{item.label}</p>
            <p className="mt-1 text-xs font-semibold capitalize text-fg">{item.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {providers.map((provider) => (
          <Card key={provider.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-fg">{provider.name}</h2>
                  <Badge tone={provider.is_enabled ? "success" : "neutral"}>{provider.is_enabled ? "Enabled" : "Disabled"}</Badge>
                  {provider.secret_set ? <Badge tone="primary">Secret set</Badge> : null}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">{provider.description}</p>
                <p className="mt-1 font-mono text-[9px] text-muted">{provider.id} · {provider.kind}</p>
              </div>
              <ShieldCheck className={`size-4 ${provider.is_enabled ? "text-success" : "text-muted"}`} />
            </div>

            <div className="mt-3 rounded-lg bg-surface-2 p-2.5 text-[10px] text-muted">
              <p className="flex items-center justify-between gap-2">
                <span>Webhook URL</span>
                <span className="truncate font-mono text-fg">{webhookBase}/{provider.id}</span>
              </p>
              <p className="mt-1">Header: <span className="font-mono">x-ngs-signature</span> = HMAC-SHA256(raw body, secret)</p>
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-[11px] font-semibold text-primary">Configure provider</summary>
              <div className="mt-2">
                <AdminActionForm action={saveProviderAction} submitLabel="Save provider" compact>
                  <input type="hidden" name="providerId" value={provider.id} />
                  <label className="mb-1 block text-[10px] font-semibold text-muted">Display name</label>
                  <Input name="name" defaultValue={provider.name} className="!h-9 !text-[11px]" />
                  <label className="mb-1 mt-2 block text-[10px] font-semibold text-muted">Config (JSON, non-secret)</label>
                  <Textarea name="config" rows={3} defaultValue={JSON.stringify(provider.config, null, 2)} className="font-mono !text-[10px]" />
                  <label className="mb-1 mt-2 block text-[10px] font-semibold text-muted">Webhook secret (leave blank to keep current)</label>
                  <Input name="secret" type="password" autoComplete="new-password" placeholder="••••••••" className="!h-9 !text-[11px]" />
                  <label className="mt-2 flex items-center gap-2 text-[11px] text-fg-soft">
                    <input type="checkbox" name="isEnabled" defaultChecked={provider.is_enabled} className="accent-[var(--primary)]" />
                    Enable this provider
                  </label>
                </AdminActionForm>
              </div>
            </details>
          </Card>
        ))}
      </div>

      <Card className="mt-4 p-5">
        <h2 className="text-sm font-semibold">Provider notes</h2>
        <div className="mt-2 space-y-2 text-[11px] leading-relaxed text-muted">
          <p><span className="font-semibold text-fg">PromptPay QR</span> — generated locally with the PromptPay ID from Settings. Without a bank/provider webhook, customers must upload a slip and staff verify. Never rely on a slip alone for automatic credit.</p>
          <p><span className="font-semibold text-fg">External webhook</span> — requires a signed payment event containing <span className="font-mono">reference</span>, <span className="font-mono">amount</span>, <span className="font-mono">provider_ref</span> and <span className="font-mono">status: PAID</span>. Replayed references are rejected by a unique constraint and the payment is flagged for review.</p>
          <p><span className="font-semibold text-fg">KBank Open API</span> — enable only after the bank approves your merchant account and you add credentials to the environment. The adapter refuses to create payments without valid bank credentials; it never simulates a payment.</p>
          <p><span className="font-semibold text-fg">Manual transfer</span> — add bank details to its config (e.g. <span className="font-mono">{'{"instructions":"KBank 123-4-56789-0"}'}</span>). Customers see the instructions on the payment page.</p>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted">
          <Copy className="size-3" /> Retired secrets should be rotated by saving a new value; old values are replaced, not displayed.
        </p>
      </Card>
    </div>
  );
}
