import "server-only";
import { cache } from "react";
import { many, one, run } from "@/lib/db";
import { env } from "@/lib/env";

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  "site.name": "NEXTGEN GAME STORE",
  "site.tagline": "Premium digital games, top-ups and accounts.",
  "site.description":
    "NEXTGEN GAME STORE is a modern digital game marketplace: game accounts, Steam keys, gift cards and instant game top-ups with a secure wallet.",
  "site.logo_url": "",
  "site.favicon_url": "",
  "contact.email": "support@nextgen.local",
  "contact.phone": "+66 00 000 0000",
  "contact.address": "Bangkok, Thailand",
  "contact.hours": "Every day 09:00 – 24:00 (ICT)",
  "social.discord": "",
  "social.facebook": "",
  "social.instagram": "",
  "social.line": "",
  "store.currency": "THB",
  "store.timezone": "Asia/Bangkok",
  "store.language": "th",
  "store.maintenance_mode": false,
  "store.registration_open": true,
  "payment.promptpay_id": "",
  "payment.receiver_name": "NEXTGEN GAME STORE",
  "payment.max_deposit": 100000,
  "payment.qr_expiry_minutes": 15,
  "payment.active_provider": "promptpay_qr",
  "payment.min_deposit": 20,
  "slip.provider": "slipok",
  "slip.enabled": false,
  "slip.slipok_branch_id": "",
  "slip.slipok_api_key": "",
  "slip.auto_approve": true,
  "slip.self_auto_credit": false,
  "truemoney.phone": "0812345678",
  "footer.about":
    "Digital goods delivered securely. Every order is tracked, every balance is backed by a ledger.",
  "legal.terms": "Terms and conditions placeholder.",
  "legal.privacy": "Privacy policy placeholder.",
  "legal.refund": "Refund policy placeholder.",
};

export const getSettings = cache(async (): Promise<Record<string, unknown>> => {
  const rows = await many<{ key: string; value: unknown }>("select key, value from system_settings");
  const merged = { ...DEFAULT_SETTINGS };
  for (const row of rows) merged[row.key] = row.value;
  return merged;
});

export async function getSetting<T = string>(key: string, fallback?: T): Promise<T> {
  const settings = await getSettings();
  return (settings[key] as T) ?? (fallback as T);
}

export async function setSettings(
  values: Record<string, unknown>,
  updatedBy: string | null,
): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    await run(
      `insert into system_settings(key, value, updated_by, updated_at)
       values ($1, $2::jsonb, $3, now())
       on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
      [key, JSON.stringify(value), updatedBy],
    );
  }
}

export async function getPromptPayConfig(): Promise<{
  promptPayId: string;
  receiverName: string;
  expiryMinutes: number;
  minDeposit: number;
  maxDeposit: number;
}> {
  const settings = await getSettings();
  return {
    promptPayId: String(settings["payment.promptpay_id"] ?? "") || env.promptPayId,
    receiverName: String(settings["payment.receiver_name"] ?? "") || env.promptPayName || "NEXTGEN GAME STORE",
    expiryMinutes: Number(settings["payment.qr_expiry_minutes"] ?? 15),
    minDeposit: Number(settings["payment.min_deposit"] ?? 20),
    maxDeposit: Number(settings["payment.max_deposit"] ?? 100000),
  };
}

export async function isMaintenanceMode(): Promise<boolean> {
  return Boolean((await getSettings())["store.maintenance_mode"]);
}

export async function getEnabledProvider(id: string): Promise<{
  id: string;
  name: string;
  kind: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
  secret_encrypted: string | null;
} | null> {
  return one(
    `select id, name, kind, is_enabled, config, secret_encrypted
     from payment_providers where id = $1`,
    [id],
  );
}
