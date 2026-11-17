# Installation

## Prerequisites

- Node.js **20.11+** (tested on Node 26)
- npm 10+
- Optional: a Supabase project (recommended for production)
- Optional: `openssl` for generating secrets (the init script uses Node crypto instead)

## A. Local development (zero cloud credentials)

```bash
git clone <your-repo> nextgen-game-store
cd nextgen-game-store
npm install
npm run env:init
npm run db:migrate
npm run db:seed-demo
npm run dev
```

- `env:init` writes `.env.local` with a 32-byte `ENCRYPTION_KEY`, a cart signing secret, webhook
  and cron secrets, and a random bootstrap admin password. It never overwrites an existing file.
- The app uses **PGlite** (real PostgreSQL compiled to WASM) in `.data/pglite`. No Docker, no
  local Postgres install.
- `db:seed-demo` requires `SEED_DEMO=true` (default in `.env.example`) and refuses to run when
  `NODE_ENV=production`.
- PGlite is single-process: stop `npm run dev` before `db:migrate`, `db:seed-demo`, or tests that
  write to `.data/pglite`.

### Demo credentials

Printed by the seed:

- Admin: `admin@nextgen.local` (password from `BOOTSTRAP_ADMIN_PASSWORD` / `env:init` output)
- Customer: `demo@nextgen.local` / `Demo1234!`

Both are development-only. Remove them before production (`DELETE FROM profiles ...` or use a
fresh production database).

### Configure PromptPay locally

Either:

1. Set `PROMPTPAY_ID` in `.env.local`, or
2. Sign in as admin → **Settings → Payment settings**, enter a PromptPay ID, save, then enable
   `promptpay_qr` in **Payment providers**.

For manual verification testing, leave the provider's webhook secret empty and use **Manual Bank
Transfer** or upload a slip. To test automatic verification, set a webhook secret in
**Payment providers → PromptPay QR → Configure provider** and send a signed event
(`docs/PAYMENT_SETUP.md`).

## B. Production with Supabase

### 1. Create the project

1. Create a Supabase project (Postgres 15+).
2. Copy the **pooled** connection string (port `6543`, transaction mode) into `DATABASE_URL`.
3. Copy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the service role key into
   the server environment. The service role key must **never** be exposed to the browser.

### 2. Run migrations

```bash
# with DATABASE_URL pointing at Supabase
npm run db:migrate
```

This applies every `.sql` migration except `.local.sql` files, including RLS policies and the
Supabase auth trigger that creates `profiles` rows for new auth users. You can also paste the
migrations into the Supabase SQL editor in filename order.

> Do not run the local auth stub in Supabase; it is skipped automatically by the CLI. If applying
> manually, skip `0000_auth_stub.local.sql`.

### 3. Bootstrap an admin

Option A (SQL editor):

```sql
-- After creating the user in Authentication → Users
update public.profiles set role_id = 'super_admin', email_verified_at = now()
where email = 'owner@example.com';
```

Option B (local script against Supabase): run `npm run db:seed-demo` with `DATABASE_URL` set is
**not** recommended for production; instead use the admin **Staff Management** page after
promoting one account via SQL.

A DB trigger creates the profile and wallet when an auth user is created; the trigger is in
`0005_supabase_auth.supabase.sql`.

### 4. Storage

Create a bucket named `product-images` (or set `SUPABASE_STORAGE_BUCKET`).

- Product images are uploaded with public URLs → the bucket (or at least the `products/` prefix)
  must allow public read.
- Payment slips are stored under `slips/<userId>/` and referenced with a private signed URL.
  Keep the bucket private if you also use it for slips, or use two buckets (recommended): one
  public for product media, one private for evidence.

### 5. Authentication providers

Follow `docs/OAUTH_SETUP.md` for Google/Facebook/Discord. Email/password with confirmation is
handled by Supabase. Configure the Site URL and redirect URLs:

- `https://your-domain.com/auth/callback`
- `https://your-domain.com/auth/confirm`

### 6. Environment variables

Use `.env.example` as the checklist. Required in production:

```
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SITE_NAME
DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ENCRYPTION_KEY
CART_COOKIE_SECRET
CRON_SECRET
PROMPTPAY_ID (or set in admin)
```

Optional but recommended: `PAYMENT_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`,
`SUPABASE_STORAGE_BUCKET`, `PAYMENT_WEBHOOK_IP_ALLOWLIST`, KBank credentials once approved.

`SEED_DEMO` **must be false/absent** in production.

### 7. Run

```bash
npm ci
npm run typecheck
npm test
npm run build
npm start
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ENCRYPTION_KEY must be a base64 encoded 32-byte key` | Run `npm run env:init` or generate `openssl rand -base64 32`. |
| `database is locked` (PGlite) | Another dev server/script is using `.data/pglite`. Stop it. |
| Social buttons say *Setup required* | Expected: enable the provider in Supabase. See OAuth guide. |
| PromptPay radio is disabled at checkout | No PromptPay ID configured, or the active provider is disabled. |
| Slip upload fails | Check `ENCRYPTION_KEY`, folder permissions, or Supabase bucket/key. |
| Admin page redirects to dashboard | The account role lacks `dashboard.view` / the required permission. |
| Migration fails on Supabase | Apply in filename order; skip `.local.sql`; ensure the `auth` schema exists (Supabase provides it). |
| First `next dev` request fails with an ArrayBuffer/stream warning (Node 26) | Known Next dev streaming quirk: refresh once. Production builds are unaffected; Node 22 LTS is recommended for development. |
| `database is locked` during E2E | PGlite is single-process: only one dev server/script may open `.data/pglite`. |
