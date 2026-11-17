import "server-only";

/**
 * Central environment access. Secrets never leave the server.
 * The app supports two deployment modes:
 *  - "local":  embedded PGlite Postgres + built-in session auth (development, QA)
 *  - "supabase": Supabase Postgres + Supabase Auth + Storage (production)
 */
const raw = process.env;

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

export const env = {
  appUrl: clean(raw.NEXT_PUBLIC_APP_URL) || "http://localhost:3000",
  siteName: clean(raw.NEXT_PUBLIC_SITE_NAME) || "NEXTGEN GAME STORE",
  nodeEnv: clean(raw.NODE_ENV) || "development",
  databaseUrl: clean(raw.DATABASE_URL),
  pgSsl: clean(raw.PGSSL) || "require",
  poolMax: Number(clean(raw.POSTGRES_POOL_MAX) || 5),
  supabaseUrl: clean(raw.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: clean(raw.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  supabaseServiceKey: clean(raw.SUPABASE_SERVICE_ROLE_KEY),
  supabaseBucket: clean(raw.SUPABASE_STORAGE_BUCKET) || "product-images",
  encryptionKey: clean(raw.ENCRYPTION_KEY),
  cartSecret: clean(raw.CART_COOKIE_SECRET),
  webhookSecret: clean(raw.PAYMENT_WEBHOOK_SECRET),
  webhookIpAllowlist: clean(raw.PAYMENT_WEBHOOK_IP_ALLOWLIST),
  cronSecret: clean(raw.CRON_SECRET),
  promptPayId: clean(raw.PROMPTPAY_ID),
  promptPayName: clean(raw.PROMPTPAY_RECEIVER_NAME),
  kbankClientId: clean(raw.KBANK_CLIENT_ID),
  kbankClientSecret: clean(raw.KBANK_CLIENT_SECRET),
  kbankMerchantId: clean(raw.KBANK_MERCHANT_ID),
  kbankEnv: clean(raw.KBANK_ENV) || "sandbox",
  resendKey: clean(raw.RESEND_API_KEY),
  emailFrom: clean(raw.EMAIL_FROM),
  seedDemo: clean(raw.SEED_DEMO) === "true",
  bootstrapAdminEmail: clean(raw.BOOTSTRAP_ADMIN_EMAIL),
  bootstrapAdminPassword: clean(raw.BOOTSTRAP_ADMIN_PASSWORD),
  bootstrapAdminName: clean(raw.BOOTSTRAP_ADMIN_NAME),
} as const;

const supabaseConfigured =
  Boolean(env.databaseUrl) && Boolean(env.supabaseUrl) && Boolean(env.supabaseAnonKey);

export const runtimeMode: "local" | "supabase" = supabaseConfigured ? "supabase" : "local";
export const isProduction = env.nodeEnv === "production";

export const setupStatus = {
  mode: runtimeMode,
  database: runtimeMode === "supabase" ? "supabase-postgres" : "embedded-postgres (dev)",
  auth: runtimeMode === "supabase" ? "supabase-auth" : "local-session",
  storage: supabaseConfigured ? "supabase-storage" : "local-disk",
  promptPayConfigured: Boolean(env.promptPayId),
  webhookConfigured: Boolean(env.webhookSecret),
  emailConfigured: Boolean(env.resendKey),
  kbankConfigured: Boolean(env.kbankClientId && env.kbankClientSecret && env.kbankMerchantId),
  encryptionConfigured: /^[A-Za-z0-9+/=]{40,}$/.test(env.encryptionKey),
  cronConfigured: Boolean(env.cronSecret),
} as const;

export function assertProductionSecrets(): string[] {
  const problems: string[] = [];
  if (!setupStatus.encryptionConfigured) problems.push("ENCRYPTION_KEY is missing or invalid");
  if (runtimeMode === "supabase" && !env.supabaseServiceKey)
    problems.push("SUPABASE_SERVICE_ROLE_KEY is required in supabase mode");
  return problems;
}
