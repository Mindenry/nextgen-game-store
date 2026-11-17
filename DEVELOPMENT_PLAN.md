# NEXTGEN GAME STORE — Development Plan

Status: **implemented** (Phases 0–20). This document is the living architecture and delivery plan.

## 1. Product intent

A commercial-grade digital game marketplace: game accounts, Steam/PC keys, gift cards, software
licences, game top-ups and a wallet. Customers buy with wallet balance or PromptPay QR; staff run
the catalogue, verify payments, deliver digital goods and handle support from a premium admin
dashboard.

## 2. Non-goals

- Storing card numbers or becoming a card acquirer.
- Scraping bank apps, intercepting banking traffic, or auto-approving payments from a slip alone.
- Faking OAuth, payments, top-up provider APIs or delivery. Anything unconfigured is visibly
  `Setup required` or falls back to manual, audited workflows.
- Multi-currency. The schema is locked to THB to avoid silent conversion errors.

## 3. Architecture

```
Browser
  │  RSC / Server Actions / Route Handlers
  ▼
Next.js 15 App Router (TypeScript, strict)
  ├─ Server-side auth & RBAC (DB-backed permissions)
  ├─ Domain services: catalogue, cart, orders, delivery, coupons, wallet, payments, top-up
  ├─ Payment adapter: PromptPay QR + signed webhook + manual verification + KBank placeholder
  └─ SQL data layer
       ├─ Production: Supabase Postgres (pooled DATABASE_URL) + Supabase Auth + Storage
       └─ Development/QA: embedded PGlite Postgres (same migrations, same SQL)
```

### Key decisions

| Decision | Why |
|---|---|
| Raw SQL through `pg`/PGlite instead of an ORM | Identical SQL on Supabase and local Postgres; precise locking (`FOR UPDATE`, `SKIP LOCKED`) for money and inventory. |
| Dual driver (`DATABASE_URL` present ⇒ Supabase) | The project is runnable and testable today without cloud credentials, while production uses Supabase unchanged. |
| Local session auth fallback | Email/password works end-to-end in dev; production uses Supabase Auth for social login and email delivery. OAuth buttons are enabled only when Supabase reports the provider enabled. |
| Integer minor units in TS, `NUMERIC(12,2)` in Postgres | No floating point money anywhere. |
| Ledger-first wallet | Balance is a cache; every change writes an immutable ledger row inside a DB transaction. A reconciliation view detects drift. |
| Provider adapter + manual fallback | The store is never coupled to one PSP; an unverified payment can only become PAID through a signed webhook or explicit staff approval. |
| Encrypted inventory | Account credentials use AES-256-GCM; list views never show secrets; reveal is a permission (`inventory.reveal`) and is audit logged. |

## 4. Phases

### Phase 0 — Analysis & planning ✅
Workspace inspected (empty), Node 26/npm 11 verified, relevant skills loaded
(`brainstorming`, `supabase-postgres-best-practices`), architecture, schema, API, UI, auth,
payment, admin and security plans written here.

### Phase 1 — Stack ✅
Next.js 15.5 App Router, React 19, TypeScript strict, Tailwind CSS v4, shadcn-style primitives,
Lucide, Framer Motion, React Hook Form + Zod, TanStack Table (available), Recharts, Vitest,
Playwright. ESLint 9 + Prettier configured.

### Phase 2 — Design system ✅
Tokens for light/dark, TH/EN typography (Noto Sans Thai + Sora), reusable UI primitives, cards,
badges, states (loading/empty/error/success), toasts, responsive layouts, reduced-motion support,
mobile bottom navigation, accessible focus rings.

### Phase 3 — Storefront ✅
Home (DB-driven hero banners, categories, featured/new/best sellers, promotions, reviews, FAQ,
payment info, contact), catalogue with search/filter/sort/price/stock/pagination, product detail
with gallery, variants, quantity, stock, delivery, terms, reviews and related products, signed
cookie cart with server price/stock revalidation, checkout with server-side totals.

### Phase 4 — Authentication ✅
Supabase Auth integration (email + Google/Facebook/Discord, verified availability), local
scrypt/session auth for dev, register, login, forgot/reset password, email verification,
OAuth callback + OTP confirm routes, session management, account suspension, role-aware guards.
Setup-required states are explicit; no fake OAuth.

### Phase 5 — Customer dashboard ✅
Overview, profile, wallet, top-up history, orders + detail, delivered products vault, coupons,
favourites, notifications, support tickets, security settings, logout.

### Phase 6 — Wallet ✅
Ledger with deposit/purchase/refund/admin credit/admin debit, row-locked balance updates,
idempotency keys, non-negative constraint, reconciliation view, admin adjustments with reason,
audit trail.

### Phase 7 — PromptPay payments ✅
Local EMVCo PromptPay QR generation with CRC16, unique references, expiry, status polling,
HMAC-SHA256 webhook verification, replay/idempotency protection, amount verification, duplicate
payment detection, manual slip upload with private storage, staff approval/rejection, provider
admin, webhook log, cron reconciliation. KBank adapter requires bank onboarding; it never fakes a
payment.

### Phase 8 — Digital delivery ✅
Encrypted inventory, atomic allocation (`FOR UPDATE SKIP LOCKED`), stock decrement, delivery
records, manual staff delivery with encrypted payload, My Products vault, notifications + audit.

### Phase 9 — Game top-up ✅
Admin-managed games with per-game field schemas, packages, dynamic customer forms, validated
server-side, order/top-up records, manual processing queue, failure notifications, refunds.
Provider adapter point documented; no free-API assumptions.

### Phase 10 — Coupons ✅
Percentage/fixed, min order, max discount, start/expiry, total and per-user limits, first purchase,
product/category restrictions, atomic usage counting, server-side validation at checkout.

### Phase 11 — Reviews & support ✅
Verified-purchase reviews with moderation and rating recalculation, support tickets with
customer/staff messages, internal notes, status workflow, notifications.

### Phase 12 — Admin ✅
Overview, analytics, orders + detail (status, notes, manual delivery, refund), products,
categories, top-up, inventory, wallets, payments, providers, customers, coupons, promotions,
banners, reviews, tickets, notifications, staff, roles & permissions, audit logs, settings.

### Phase 13 — Database ✅
31+ required tables plus sessions, rate limits, favourites, reconciliation views, sequences,
indexes, unique/check constraints, triggers, RLS policies, portable migrations.

### Phase 14 — Security ✅
Server-side authz on every action, RLS defence in depth, Zod validation, parameterised SQL,
scrypt, AES-GCM, HMAC webhooks, signed cart cookie, rate limits, private uploads with magic-byte
validation, CSP/security headers, audit logging, environment-only secrets, open-redirect protection.

### Phase 15 — Notifications ✅
In-app notification centre with transactional events and admin broadcasts; email adapter
(Resend) with a development outbox. Discord webhook can reuse the same adapter pattern.

### Phase 16 — Settings & CMS ✅
Store identity, contact, socials, legal content, maintenance mode, registration toggle, currency
and timezone defaults, payment settings, provider configuration, TH/EN switching.

### Phase 17 — Customer experience ✅
Search suggestions, recently viewed, favourites, order tracking, responsive navigation, mobile
bottom nav, confirmation dialogs, loading feedback, error recovery, helpful empty states.

### Phase 18 — Testing & QA ✅
- Vitest: 34 unit tests across money, coupons, PromptPay CRC, slip Mini-QR parsing/decoding,
  crypto, SlipOK mapping and RBAC — **passing**.
- Playwright: 16 E2E tests — storefront/search/responsive, wallet checkout + auto-delivery,
  inventory replenishment, RBAC block, manual slip approval, webhook signature/replay/amount
  mismatch, game top-up fulfilment, dedicated payment settings, TrueMoney Angpao and all 23 admin
  modules — **passing** (Chrome channel).
- Production `next start` smoke: key routes return HTTP 200; login, theme toggle and admin
  client navigation verified.
- Typecheck, ESLint, unit tests and production build pass.
- Cashier-grade reconciliation is covered by DB constraints and the reconciliation view; run
  the documented acceptance checklist against your live banking configuration.

### Phase 19 — Deployment ✅
`.env.example`, installation, deployment, payment setup, OAuth setup, admin guide, security and
database docs. Vercel + Supabase + cron instructions.

### Phase 20 — Acceptance
Live third-party acceptance (OAuth provider consent, real PromptPay webhook, real bank transfer,
KBank merchant approval) requires the store owner's credentials and cannot be fabricated. All
code paths, setup guides and setup-required states are in place; see the checklist in README.

## 5. Deliberate limitations (owner action required)

| Item | Status | Action |
|---|---|---|
| PromptPay automatic verification | Works when a signed webhook provider or SlipOK is configured | Obtain a provider webhook and/or a SlipOK Branch ID + API key. Otherwise manual slip verification plus the free self-hosted Mini-QR pre-check. |
| Free self-hosted slip check | Parses/validates slip Mini QR, CRC, bank + transfer reference and blocks reuse | It cannot prove the transfer/amount at the bank. Staff must confirm with the bank; use SlipOK/KBank for true auto-confirmation. |
| TrueMoney Angpao | Manual redemption to the shop phone 0812345678 with encrypted voucher link + unique code | Staff redeem in the official app. Automatic redemption requires an official TrueMoney merchant API; no OTP/session automation. |
| KBank Open API | Adapter refuses to operate without credentials | Complete KBank merchant onboarding, add credentials, implement the approved request/response mapping. |
| Social login | Code complete; buttons gated by Supabase provider availability | Follow `docs/OAUTH_SETUP.md`. |
| Email delivery | Resend adapter + dev outbox | Set `RESEND_API_KEY` + verified sender. |
| Supabase Storage | Supported for uploads | Create bucket; product images need public read, slips remain private. |
| Game top-up API | Manual fulfilment implemented | Contract a top-up provider and implement its adapter; schemas already support it. |
| 2FA | Not implemented | Add Supabase MFA / TOTP if required. |

## 6. Conventions

- TypeScript strict, no `any` in domain logic, Zod at every boundary.
- Money in satang internally; `NUMERIC` in DB.
- All mutations are server actions or route handlers; no privileged DB access from the browser.
- Every admin mutation writes an audit log.
- Every user-visible failure has a state; no silent success.
