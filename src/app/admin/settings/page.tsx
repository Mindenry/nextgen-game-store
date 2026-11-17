import Link from "next/link";
import { CheckCircle2, CircleAlert, Settings as SettingsIcon } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { getSettings } from "@/lib/settings";
import { listPaymentProviders } from "@/lib/admin";
import { env, runtimeMode, setupStatus } from "@/lib/env";
import { getOAuthAvailability } from "@/lib/auth/oauth";
import { Badge, Card, Input, Select, Textarea } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import { savePaymentSettingsAction } from "@/actions/admin-finance";
import { saveStoreSettingsAction } from "@/actions/admin-content";

export const metadata = { title: "Store settings" };

export default async function AdminSettingsPage() {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.settingsManage)) return <AccessDenied permission={PERMISSIONS.settingsManage} />;
  const [settings, providers, oauth] = await Promise.all([
    getSettings(),
    listPaymentProviders(),
    getOAuthAvailability(),
  ]);
  const str = (key: string) => String(settings[key] ?? "");
  const bool = (key: string) => Boolean(settings[key]);
  const enabledProviders = providers.filter((provider) => provider.is_enabled);

  const checks = [
    { label: "Database", ok: true, value: setupStatus.database },
    { label: "Auth", ok: true, value: setupStatus.auth },
    { label: "Encryption key", ok: setupStatus.encryptionConfigured, value: setupStatus.encryptionConfigured ? "configured" : "missing" },
    { label: "PromptPay ID", ok: Boolean(str("payment.promptpay_id") || env.promptPayId), value: str("payment.promptpay_id") || env.promptPayId || "not set" },
    { label: "Webhook secret", ok: Boolean(env.webhookSecret), value: env.webhookSecret ? "configured" : "not set" },
    { label: "Email provider", ok: Boolean(env.resendKey), value: env.resendKey ? "Resend" : "dev outbox" },
    { label: "Cron secret", ok: Boolean(env.cronSecret), value: env.cronSecret ? "configured" : "not set" },
    { label: "Storage", ok: Boolean(env.supabaseServiceKey), value: env.supabaseServiceKey ? "Supabase Storage" : "local disk (dev)" },
    { label: "Google OAuth", ok: oauth.google, value: oauth.google ? "enabled" : runtimeMode === "supabase" ? "setup required" : "requires Supabase" },
    { label: "Facebook OAuth", ok: oauth.facebook, value: oauth.facebook ? "enabled" : runtimeMode === "supabase" ? "setup required" : "requires Supabase" },
    { label: "Discord OAuth", ok: oauth.discord, value: oauth.discord ? "enabled" : runtimeMode === "supabase" ? "setup required" : "requires Supabase" },
    { label: "KBank API", ok: setupStatus.kbankConfigured, value: setupStatus.kbankConfigured ? "configured" : "not configured" },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Configuration"
        title="Store settings"
        description="Branding, contact details, legal content, wallet limits and payment routing. Secrets stay in environment variables."
        actions={<Badge tone={runtimeMode === "supabase" ? "success" : "warning"}>{runtimeMode === "supabase" ? "Supabase mode" : "Local dev mode"}</Badge>}
      />

      <div className="mb-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2">
            <div className="flex items-center gap-2">
              {check.ok ? <CheckCircle2 className="size-3.5 text-success" /> : <CircleAlert className="size-3.5 text-warning" />}
              <span className="text-[11px] font-medium text-fg">{check.label}</span>
            </div>
            <span className="max-w-[45%] truncate text-[10px] capitalize text-muted">{check.value}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_420px] xl:items-start">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><SettingsIcon className="size-4 text-primary" /> Storefront &amp; legal</h2>
          <div className="mt-4">
            <AdminActionForm action={saveStoreSettingsAction} submitLabel="Save store settings">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted">Store name</label>
                  <Input name="siteName" defaultValue={str("site.name")} required />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted">Tagline</label>
                  <Input name="tagline" defaultValue={str("site.tagline")} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted">Logo URL</label>
                  <Input name="logoUrl" defaultValue={str("site.logo_url")} placeholder="https://…" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted">Default language</label>
                  <Select name="defaultLanguage" defaultValue={str("store.language")}>
                    <option value="th">ไทย (TH)</option>
                    <option value="en">English (EN)</option>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted">Contact email</label>
                  <Input name="contactEmail" type="email" defaultValue={str("contact.email")} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted">Contact phone</label>
                  <Input name="contactPhone" defaultValue={str("contact.phone")} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted">Address</label>
                  <Input name="contactAddress" defaultValue={str("contact.address")} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted">Support hours</label>
                  <Input name="contactHours" defaultValue={str("contact.hours")} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted">Discord URL</label>
                  <Input name="discord" defaultValue={str("social.discord")} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted">Facebook URL</label>
                  <Input name="facebook" defaultValue={str("social.facebook")} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted">Instagram URL</label>
                  <Input name="instagram" defaultValue={str("social.instagram")} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted">LINE URL</label>
                  <Input name="line" defaultValue={str("social.line")} />
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-[11px] font-semibold text-muted">Store description (SEO)</label>
                <Textarea name="description" rows={2} defaultValue={str("site.description")} />
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-[11px] font-semibold text-muted">Footer about</label>
                <Textarea name="footerAbout" rows={2} defaultValue={str("footer.about")} />
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-[11px] font-semibold text-muted">Terms of service</label>
                <Textarea name="terms" rows={3} defaultValue={str("legal.terms")} />
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-[11px] font-semibold text-muted">Privacy policy</label>
                <Textarea name="privacy" rows={3} defaultValue={str("legal.privacy")} />
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-[11px] font-semibold text-muted">Refund policy</label>
                <Textarea name="refund" rows={3} defaultValue={str("legal.refund")} />
              </div>

              <div className="mt-3 flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-[11px] text-fg-soft">
                  <input type="checkbox" name="maintenanceMode" defaultChecked={bool("store.maintenance_mode")} className="accent-[var(--primary)]" />
                  Maintenance mode (staff only)
                </label>
                <label className="flex items-center gap-2 text-[11px] text-fg-soft">
                  <input type="checkbox" name="registrationOpen" defaultChecked={bool("store.registration_open")} className="accent-[var(--primary)]" />
                  Registration open
                </label>
              </div>
            </AdminActionForm>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Payment settings</h2>
            <p className="mt-1 text-[11px] text-muted">
              PromptPay ID, minimum deposit and SlipOK verification now live on a dedicated page.
            </p>
            <Link href="/admin/payment-settings" className="mt-3 inline-block text-[11px] font-semibold text-primary hover:underline">
              Open PromptPay &amp; slip verification setup →
            </Link>
            <div className="mt-3">
              <AdminActionForm action={savePaymentSettingsAction} submitLabel="Save payment settings" compact>
                <label className="mb-1 block text-[11px] font-semibold text-muted">PromptPay ID</label>
                <Input name="promptPayId" defaultValue={str("payment.promptpay_id")} placeholder="0812345678 / 13-digit ID" />
                <p className="mt-1 text-[10px] text-muted">A QR is generated locally from this ID; funds are verified only by webhook or staff.</p>
                <label className="mb-1 mt-2 block text-[11px] font-semibold text-muted">Receiver name</label>
                <Input name="receiverName" defaultValue={str("payment.receiver_name")} />
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold text-muted">Min deposit</label>
                    <Input name="minDeposit" type="number" step="0.01" min="1" defaultValue={str("payment.min_deposit")} className="!h-9 !text-xs" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold text-muted">Max deposit</label>
                    <Input name="maxDeposit" type="number" step="0.01" min="1" defaultValue={str("payment.max_deposit")} className="!h-9 !text-xs" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold text-muted">QR expiry (min)</label>
                    <Input name="qrExpiry" type="number" min="1" defaultValue={str("payment.qr_expiry_minutes")} className="!h-9 !text-xs" />
                  </div>
                </div>
                <label className="mb-1 mt-2 block text-[11px] font-semibold text-muted">Active provider</label>
                <Select name="activeProvider" defaultValue={str("payment.active_provider")}>
                  {enabledProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                  ))}
                </Select>
              </AdminActionForm>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Setup guides</h2>
            <ul className="mt-2 space-y-1.5 text-[11px] text-muted">
              <li><span className="font-mono text-fg">docs/PAYMENT_SETUP.md</span> — PromptPay, webhook, manual review</li>
              <li><span className="font-mono text-fg">docs/OAUTH_SETUP.md</span> — Google, Facebook, Discord</li>
              <li><span className="font-mono text-fg">docs/DEPLOYMENT.md</span> — Vercel + Supabase + cron</li>
              <li><span className="font-mono text-fg">docs/SECURITY.md</span> — threat model and checklist</li>
            </ul>
            <p className="mt-3 text-[10px] text-muted">OAuth buttons render only when the provider is actually enabled in Supabase.</p>
            <Link href="/admin/payment-providers" className="mt-3 inline-block text-[11px] font-semibold text-primary hover:underline">
              Configure payment providers →
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
