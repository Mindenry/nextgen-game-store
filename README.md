# NEXTGEN GAME STORE

A full-stack digital game store, wallet and game top-up platform built with Next.js 15,
TypeScript, Tailwind CSS and PostgreSQL (Supabase in production, embedded PGlite for local
development).

It is not a UI prototype: catalogue, cart, checkout, wallet ledger, PromptPay/manual payments,
encrypted digital delivery, top-up fulfilment, support, RBAC and the admin dashboard all run
against the database.

---

## Quick start (local, no cloud account)

```bash
npm install
npm run env:init        # creates .env.local with strong random keys
npm run db:migrate      # embedded Postgres schema + reference data
npm run db:seed-demo    # dev-only demo catalogue, games, orders, admin (SEED_DEMO=true)
npm run dev
```

Open <http://localhost:3000>.

The seed prints the generated admin password. Defaults:

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@nextgen.local` | printed by `npm run env:init` (or `BOOTSTRAP_ADMIN_PASSWORD`) |
| Demo customer | `demo@nextgen.local` | `Demo1234!` |

Demo rows exist only when `SEED_DEMO=true` and `NODE_ENV !== production`. Delete or replace them
before going live.

> **Embedded database note:** PGlite is a single-process database. Stop the dev server before
> running `db:migrate` or `db:seed-demo`.

## Production (summary)

1. Create a Supabase project and run `supabase/migrations/*.sql` (or `npm run db:migrate` with
   `DATABASE_URL` set). The local-only auth stub and the Supabase auth trigger are selected
   automatically by filename.
2. Set `DATABASE_URL` (pooler), Supabase URL/anon/service keys, `ENCRYPTION_KEY`,
   `CART_COOKIE_SECRET`, `CRON_SECRET` and your payment/email credentials in the host.
3. Create the Storage bucket (`SUPABASE_STORAGE_BUCKET`); make **product images** publicly
   readable and keep slips private.
4. Deploy to Vercel; configure the cron (`/api/cron/reconcile`) with `CRON_SECRET`.
5. Sign in as the bootstrap Super Admin, replace demo content, set the PromptPay ID, providers
   and legal pages.

Full steps: [`docs/INSTALLATION.md`](docs/INSTALLATION.md) ·
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Features

- **Storefront** — DB-driven homepage, categories/subcategories, search suggestions, filters,
  sorting, price range, stock, variants, reviews, recently viewed, favourites, TH/EN UI.
- **Accounts** — Supabase Auth or local sessions, OAuth-ready, verification, password reset,
  profile, security settings and session revocation.
- **Wallet** — auditable double-entry-style ledger, idempotent deposits, refunds, admin
  adjustments, non-negative balances, reconciliation view.
- **Payments** — EMVCo PromptPay QR, signed webhook verification, replay/duplicate/amount checks,
  manual slip review with private evidence, **free self-hosted slip Mini-QR parser**, **SlipOK
  bank-side verification**, duplicate-slip/reference protection, **TrueMoney Angpao (manual
  redemption to the shop phone)**, provider management, webhook log, expiry job.
- **Delivery** — AES-256-GCM encrypted inventory, atomic allocation, manual delivery payloads,
  customer vault, notifications and audit logs.
- **Game top-up** — admin-defined games, field schemas and packages; dynamic customer form;
  validated orders; manual fulfilment queue; refunds.
- **Admin** — 21 modules: analytics, orders, catalogue, inventory, payments, providers,
  customers, coupons, promotions, banners, reviews, support, staff, RBAC, audit, settings.
- **Security** — server-side authorization, RLS, rate limiting, CSP, scrypt, HMAC, idempotency,
  open-redirect protection, audit trail, encrypted secrets.

## Tests

```bash
npm test                     # Vitest unit tests (34)
npm run typecheck
npm run build

# E2E (16 scenarios). Use installed Chrome, or install Playwright's Chromium first.
npm run test:e2e:chrome
# or:
npx playwright install chromium-headless-shell && npm run test:e2e
```

See [`docs/TESTING.md`](docs/TESTING.md) for the scenario matrix.

## Documentation

| Document | Contents |
|---|---|
| [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) | Architecture, phases, decisions, limitations |
| [docs/INSTALLATION.md](docs/INSTALLATION.md) | Local and production installation |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Vercel + Supabase deployment and post-deploy checks |
| [docs/PAYMENT_SETUP.md](docs/PAYMENT_SETUP.md) | PromptPay, webhooks, manual review, KBank |
| [docs/OAUTH_SETUP.md](docs/OAUTH_SETUP.md) | Google/Facebook/Discord via Supabase |
| [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) | Daily store operations |
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Tables, ER diagram, RLS, ledger |
| [docs/SECURITY.md](docs/SECURITY.md) | Threat model and security checklist |
| [docs/TESTING.md](docs/TESTING.md) | Unit/E2E coverage and acceptance checklist |

## Acceptance checklist

- [x] Storefront, responsive UI, light/dark mode, TH/EN
- [x] Account system, email/password, verification, reset; OAuth code + setup guide
- [x] Product/category management, cart, checkout with server-side pricing
- [x] Wallet ledger, deposits, refunds, admin adjustments
- [x] PromptPay QR, webhook verification, manual fallback
- [x] Automatic + manual digital delivery, encrypted credentials
- [x] Game top-up workflow with dynamic fields
- [x] Admin dashboard, RBAC, audit logs
- [x] Migrations, RLS policies, reconciliation view
- [x] Unit tests (34) + E2E tests (16), typecheck, lint, production build
- [x] Documentation for install, deploy, payments, OAuth, admin, database, security
- [ ] Live provider credentials, bank approval and OAuth consent (owner-supplied)
- [ ] Replace demo catalogue and demo accounts before go-live

## Licence / attribution

All branding, copy and UI in this repository are original. No assets, code, logos or branding
from any reference store were copied. Demo product photography uses Unsplash images (replace
with licensed store assets).

Slip Mini-QR parsing logic/test vectors are adapted from open-source projects under MIT/Apache-2.0;
see [NOTICE](NOTICE) for attribution. It is a structural pre-check and never claims bank
confirmation by itself.
