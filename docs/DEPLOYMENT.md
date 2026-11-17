# Deployment

## Recommended topology

| Layer | Service |
|---|---|
| App | Vercel (Next.js 15 App Router) |
| Database | Supabase Postgres (transaction pooler) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Cron | Vercel Cron (or any scheduler) hitting `/api/cron/reconcile` |
| Email | Resend (optional) |

## 1. Prepare Supabase

1. Create the project in the region closest to your customers (e.g. Singapore).
2. Apply migrations (`npm run db:migrate` with `DATABASE_URL`).
3. Create the storage bucket(s); public read for product media, private for slips.
4. Configure Auth site URL and redirect URLs.
5. Enable OAuth providers you will actually support.
6. Create the owner account, verify it, then promote to `super_admin` in SQL.

## 2. Vercel project

1. Import the repository. Framework preset: **Next.js**.
2. Add all environment variables from `.env.example`. Use the **pooled** database URL
   (`...pooler.supabase.com:6543`) for serverless. Set `POSTGRES_POOL_MAX=2..5`.
3. `PGSSL=require`.
4. Deploy. Build should run `next build`; typecheck and tests can be added as CI steps.

### Environment matrix

| Variable | Production | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://store.example.com` | No trailing slash. Used for OAuth, emails, webhook docs. |
| `DATABASE_URL` | Supabase pooler URL | Secrets manager only. |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Public. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | Public; RLS limits it. |
| `SUPABASE_SERVICE_ROLE_KEY` | service role | Server only. Never `NEXT_PUBLIC_`. |
| `ENCRYPTION_KEY` | 32-byte base64 | Required. Rotating it makes existing inventory undecryptable — plan a re-encryption job. |
| `CART_COOKIE_SECRET` | random | Cart signature. Rotating invalidates carts only. |
| `PROMPTPAY_ID` | merchant ID | Or set in admin settings. |
| `PAYMENT_WEBHOOK_SECRET` | random 32+ bytes | fallback secret for generic providers. |
| `CRON_SECRET` | random 32+ bytes | Required for reconciliation endpoint. |
| `RESEND_API_KEY` / `EMAIL_FROM` | optional | Without it, email is written to `.data/outbox` (not suitable for production). |
| `SUPABASE_STORAGE_BUCKET` | `product-images` | Must exist. |
| `SEED_DEMO` | **false/absent** | Prevents demo seeding. |

## 3. Domain and security headers

- Attach the custom domain in Vercel; update `NEXT_PUBLIC_APP_URL` and Supabase redirect URLs.
- Security headers and CSP are set in `next.config.ts`. If you add an external analytics domain,
  extend `connect-src`/`script-src` deliberately.
- HSTS is enforced by Vercel for custom domains; verify.

## 4. Cron

`vercel.json` example:

```json
{
  "crons": [
    { "path": "/api/cron/reconcile", "schedule": "*/10 * * * *" }
  ]
}
```

The endpoint requires `Authorization: Bearer $CRON_SECRET`. It:

- expires stale `PENDING`/`VERIFYING` payments,
- cancels unpaid orders,
- releases coupon usage,
- cleans rate-limit rows.

If you use an external scheduler, call the same endpoint with the bearer token.

Manual review reminders can be added as a second job; currently staff see counts in the sidebar
and payments page.

## 5. Payment provider webhook

Point your provider to:

```
https://your-domain.com/api/webhooks/payments/<providerId>
```

Set the HMAC secret in **Admin → Payment Providers**, and confirm signature + JSON contract in
`docs/PAYMENT_SETUP.md`. Test in sandbox before switching the provider live.

## 6. Post-deploy checklist

- [ ] `GET /api/health` returns the expected mode (see health route).
- [ ] Storefront loads with production catalogue; no demo data.
- [ ] Admin can sign in; customer account cannot reach `/admin`.
- [ ] PromptPay QR renders with the real merchant ID (scan with your banking app in test mode).
- [ ] Webhook: invalid signature → 401; valid event → 200; duplicate → no double credit.
- [ ] Manual slip upload → admin review → wallet credit.
- [ ] Buy a low-value real product with wallet; credentials visible only to buyer.
- [ ] Refund credited once and audit logged.
- [ ] RLS: use the anon key to query `orders`/`wallets` and confirm no other user's data returns.
- [ ] Legal pages and contact details replaced.
- [ ] Backups/PITR enabled in Supabase.
- [ ] Rotate bootstrap/demo credentials; remove demo accounts and rows.
- [ ] Cron logs show successful reconciliation.
- [ ] Error monitoring configured (Sentry/Logtail or Vercel logs).

## 7. Rollback

1. Redeploy the previous Vercel build.
2. Do **not** roll back money-related migrations blindly. Take a Supabase backup/PITR snapshot
   before any schema change that touches wallet/payment tables.
3. Payment webhooks continue to arrive during an incident; capture them in the provider dashboard
   and replay after the fix. The signature + reference idempotency make safe replay possible.
