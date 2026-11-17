# Security

## Threat model (summary)

| Asset | Threats | Primary controls |
|---|---|---|
| Wallet balance | Client tampering, double-spend, duplicate webhooks, race conditions | Ledger-only writes, DB transactions, row locks, idempotency keys, unique references, webhook signature, non-negative constraint |
| Inventory credentials | Enumeration, admin overexposure, DB breach | AES-256-GCM at rest, permission-gated reveal + audit, no secrets in list APIs, private delivery vault |
| Customer accounts | Credential stuffing, enumeration, session theft, OAuth CSRF | scrypt, rate limits, generic auth errors, HttpOnly/SameSite/Secure cookies, Supabase PKCE, safe redirects |
| Payments | Forged webhooks, replay, amount mismatch, slip fraud | HMAC-SHA256 constant-time compare, amount check, provider-ref uniqueness, staff verification, audit log |
| Admin surface | Privilege escalation, CSRF, XSS | Server-side permission checks, RLS, Zod validation, React escaping, CSP, non-GET mutations |
| Secrets | Leakage via Git/client bundle | `.env.local` gitignored, secrets only in server modules, provider secrets encrypted, `.env.example` placeholders |
| Uploads | Malicious files, path traversal | MIME + magic-byte checks, 5 MB cap, random names, path confinement, private slip access checks |

## Authentication

**Supabase mode:** `@supabase/ssr` with cookie-based sessions, server-side `auth.getUser()`
validation, OAuth authorization-code flow with PKCE and state handling. Session refresh middleware
never grants authorization by itself.

**Local mode (development):** scrypt (N=16384, r=8, p=1, 64-byte key) with per-user salt; opaque
256-bit session tokens stored only as SHA-256 hashes; 30-day expiry; HTTP-only, SameSite=Lax,
Secure in production. Suspended accounts are rejected on every request.

Password reset:

- Local: single-use token (1 hour), stored hashed, revokes all sessions on use.
- Supabase: `resetPasswordForEmail` + PKCE callback.
- Forgot-password always responds the same way (anti-enumeration).

## Authorization

Four layers:

1. **Server guard** on every page/action (`requireStaff`, `requireUser`, `can`/`requirePermission`).
   UI hiding is cosmetic; the server rejects the operation regardless.
2. **Database-backed RBAC** via `roles`, `permissions`, `role_permissions`. Super Admin always has
   all permissions; Customer is fixed.
3. **RLS policies** on every table for anon/authenticated Supabase access. Business data is only
   reachable through the server's privileged connection.
4. **Column grants** prevent a customer updating their own `role_id` or `status` even if an RLS
   policy were too broad.

Roles: Customer, Support, Finance, Product Manager, Admin, Super Admin (plus `staff.manage` /
`roles.manage` reserved for Super Admin).

## Money and transactional integrity

- Amounts are `NUMERIC(12,2)`; TypeScript uses integer satang. No floats.
- Wallet balance is updated only inside a transaction after `SELECT ... FOR UPDATE` on the wallet
  row; a check constraint rejects negative balances.
- Ledger rows include `balance_after`, a unique reference, and optional payment/order/admin links.
  `v_wallet_reconciliation` surfaces drift.
- Purchases, deliveries, inventory allocation and wallet debits commit atomically. Any failure
  rolls the whole transaction back.
- Inventory uses `FOR UPDATE SKIP LOCKED`; two simultaneous buyers cannot receive the same unit.
- Checkout recomputes prices, coupon eligibility and stock from the database; client totals are
  ignored.
- Idempotency keys (`idempotency_keys`) guard checkout/deposit retries.
- Webhooks: signature, amount, provider reference uniqueness, duplicate-payment detection, and
  per-payment row lock make replay safe.
- An already-paid order receiving another payment is flagged `MANUAL_REVIEW`, never auto-credited.

## Input validation and injection

- Zod schemas at every form/action boundary; UUID and enum checks before SQL.
- All SQL uses parameter placeholders; no string interpolation of user input.
- Dynamic admin queries interpolate only fixed allow-listed SQL fragments (sort/status/table
  names from constants).
- Search input is length-capped; React escapes rendered text; no `dangerouslySetInnerHTML` except
  a JSON-LD block built from database values.
- HTML from admin fields is rendered as text (`whitespace-pre-line`), not raw HTML.

## Sessions, CSRF and headers

- Next.js Server Actions enforce same-origin POSTs; cookies are SameSite=Lax.
- OAuth redirects are restricted to relative same-origin paths.
- Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff`, strict referrer policy and a
  restrictive permissions policy are configured in `next.config.ts`.
- CSP currently allows `'unsafe-inline'` for styles and scripts because Next injects inline
  bootstrap code. Move to nonces if your threat model requires strict CSP.
- `poweredByHeader` is disabled.

## Rate limiting

Fixed-window, atomic Postgres rate limits (works across serverless instances) for login (IP +
email), registration, password reset, checkout, deposit, slip upload, coupon attempts, ticket
creation and top-up orders. Stale rows are pruned by the reconcile cron.

## Uploads

- JPG/PNG/WebP only; MIME **and** magic bytes checked.
- Max 5 MB; random filenames; path traversal blocked.
- Slips are accessible only to their owner or staff with `payments.verify`.
- Slip images are hashed (SHA-256); a hash can only belong to one payment, blocking reused slips.
- The free self-hosted pre-check decodes the slip QR and stores the bank/transaction reference; the
  reference is unique. This is **not** a bank confirmation and does not auto-credit.
- TrueMoney voucher links are encrypted at rest and their voucher code is hashed/unique. Staff
  redemption is manual; no OTP or TrueMoney session is stored.
- When SlipOK is enabled, slip images are sent to SlipOK over HTTPS for bank verification; the API
  key is encrypted at rest and never rendered back to the UI. If this third-party data transfer is
  not acceptable, leave SlipOK disabled and verify manually.
- Supabase Storage: use a private bucket for slips. Product images are public; never store
  sensitive media there.
- The local file route sets `Content-Security-Policy: default-src 'none'; sandbox` and no-sniff.

## Logging and monitoring

- `audit_logs` records actor, email, action, entity, before/after, IP, user agent and timestamp for
  sensitive changes (products, orders, payments, refunds, staff, settings, inventory reveal,
  auth events).
- Webhook attempts (including invalid signatures) are written to `payment_events`.
- Failed audit writes are logged to the server console instead of being silently dropped.
- Never log secrets, full credentials or card data. Decrypted inventory is returned only on an
  explicit reveal action.

## Secrets management

- Only `.env.example` is committed. `.env.local`, `.env`, `.data/` and uploads are gitignored.
- `SUPABASE_SERVICE_ROLE_KEY` and `ENCRYPTION_KEY` are imported only in `server-only` modules.
- Provider webhook secrets are stored AES-256-GCM encrypted; the UI only shows whether a secret is
  set, never the value.
- Rotating `ENCRYPTION_KEY` makes existing inventory/payment evidence undecryptable — plan a
  re-encryption migration before rotating.

## Verification checklist (run before launch)

- [ ] Customer cannot open `/admin`; server actions reject unauthorized roles.
- [ ] Customer A cannot read Customer B's orders/wallet/products (test RLS with the anon key).
- [ ] Wallet cannot go negative under concurrent purchases.
- [ ] Stock cannot be oversold under concurrent checkouts.
- [ ] Duplicate webhook does not double-credit.
- [ ] Invalid signature returns 401 and is logged.
- [ ] Amount mismatch returns 409 and is logged.
- [ ] Expired payment releases the coupon and cancels the unpaid order.
- [ ] Suspended user sessions are revoked.
- [ ] Uploading a renamed `.exe` as `.png` is rejected.
- [ ] `/admin` is excluded from robots and sitemap.
- [ ] All secrets absent from the client bundle (`grep` the build output for key prefixes).
- [ ] `E2E_BYPASS_RATE_LIMIT` is absent/false in production (the bypass is ignored when `NODE_ENV=production`).
- [ ] Backups/PITR enabled; restore tested.

## Known residual risks / owner actions

- **No 2FA/MFA** for staff accounts yet. Add Supabase MFA or an SSO layer for high-value stores.
- The server's direct Postgres role is privileged by design and bypasses RLS; keep the connection
  string server-only and rotate it.
- Automatic PromptPay verification depends on a third-party webhook contract; without one, fraud
  prevention relies on staff checking the bank statement.
- Email deliverability depends on your provider/domain authentication (SPF/DKIM/DMARC).
- Legal compliance (PDPA/GDPR, tax, consumer law) is store-owner responsibility.
- CSP allows inline scripts; add nonces if you need a stricter policy.
