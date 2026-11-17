# Testing & QA

## Commands

```bash
npm run typecheck            # tsc --noEmit (strict)
npm test                     # Vitest unit suite
npm run build                # production build

# E2E: either install Playwright's browser...
npx playwright install chromium-headless-shell
npm run test:e2e

# ...or run against an installed Chrome (used for the recorded results)
npm run test:e2e:chrome
```

Playwright reuses an existing dev server when one is running. E2E mutates the **demo** database, so
run it against a disposable environment, not production. PGlite only allows one process: stop
other scripts that open `.data/pglite` while the dev server is running.

## Unit tests (Vitest)

| File | Covers |
|---|---|
| `money.test.ts` | satang conversion, malformed input, numeric serialisation, formatting, coupon math |
| `coupons.test.ts` | percentage/fixed caps, eligibility restrictions, largest-remainder discount allocation |
| `promptpay.test.ts` | target normalisation, EMV field structure, CRC16-CCITT trailer, amount/reference validation |
| `crypto.test.ts` | AES-256-GCM round-trip, tamper detection, scrypt hashing/verification, constant-time HMAC compare |
| `rbac.test.ts` | customer denial, granted permissions, null-user safety |
| `slipok.test.ts` | SlipOK success mapping, duplicate slip, amount mismatch, wrong receiver, bank delay, auth failure |
| `bank-statement.test.ts` | Thai/English CSV headers, Buddhist year, quoted commas, thousands separators, debit columns, stable fingerprints, unreadable files |
| `easyslip.test.ts` | EasySlip response mapping, duplicate/amount/pending/auth cases, Thai+English receiver-name matching |
| `easyslip-verify.test.ts` | full verification pipeline with a stubbed provider: verified, wrong receiver, duplicate, amount mismatch, old slip, missing configuration |
| `slip-payload.test.ts` | standard bank slip Mini QR, TrueMoney slip, CRC tamper, non-slip payload, duplicate CRC |
| `slip-qr.test.ts` | server-side QR decoding from PNG for standard and TrueMoney slips |

Results (this machine): **11 files, 56 tests passing**.

## E2E tests (Playwright)

| Spec | Scenarios |
|---|---|
| `storefront.spec.ts` | homepage sections, live search suggestions + submit, category filter, product detail, verified review, mobile drawer, 404, guest checkout redirect |
| `checkout.spec.ts` | admin wallet adjustment, customer login, add to cart, coupon preview, terms acceptance, wallet checkout, success page, automatic inventory delivery, credential reveal, ledger entry, customer blocked from `/admin` |
| `payments-admin.spec.ts` | PromptPay ID + provider secret setup, deposit QR, slip upload, staff approval, wallet credit, review queue removal, webhook invalid signature (401), valid signature (200), status API, replay idempotency, duplicate provider ref (409), amount mismatch (409) |
| `topup.spec.ts` | dynamic top-up field validation, wallet top-up order, staff completion in the fulfilment queue, customer vault/order status |
| `admin.spec.ts` | all 23 admin modules render without an error boundary, order-detail navigation |
| `payment-settings.spec.ts` | dedicated PromptPay/SlipOK page renders, minimum deposit is ฿1, ฿1 test product is purchasable |
| `bank-reconciliation.spec.ts` | statement import verifies a payment and credits once, duplicate import never double-credits, ambiguous amounts wait for a human, a slip alone never credits |
| `truemoney.spec.ts` | TrueMoney Angpao provider selection, voucher link submission, encrypted voucher review, staff approval, wallet credit |

The webhook test computes a real HMAC-SHA256 over the raw JSON body using the secret configured
through the admin UI, so it exercises the production route end-to-end.

Recorded result for this build: **19 E2E tests passing** (Chrome channel), plus a production
`next start` smoke check of `/`, `/products`, product detail, `/topup`, `/login`, `/api/health`
and `/robots.txt` (all HTTP 200). Admin client navigation, theme toggle and account menu were
verified in the production build.

### Test environment notes

- `E2E_BYPASS_RATE_LIMIT="true"` is set in the local `.env.local` by the test setup. It is ignored
  when `NODE_ENV=production` and must never be enabled on a deployed store. It only keeps repeated
  local runs from exhausting the login rate-limit window.
- The checkout spec replenishes one encrypted inventory unit and credits the demo wallet before
  the purchase, so the suite is repeatable.
- PGlite is single-process; stop `next dev` before running scripts that open `.data/pglite`.
- On Node 26, the very first request after `next dev` can hit a Next streaming/ArrayBuffer warning.
  Refresh once; production builds are unaffected. Node 22 LTS is the safest dev runtime.

## Database-level verification (recorded)

Run against the embedded Postgres with RLS active:

| Check | Result |
|---|---|
| `SET ROLE authenticated` + customer JWT subject → `orders` | 18 rows, own orders only |
| Same role → `profiles` | 1 row (own profile) |
| Same role → `product_inventory` | **permission denied** |
| `SET ROLE anon` → `orders` | **permission denied** |
| `SET ROLE anon` → `products` | 12 active products (public) |
| `v_wallet_reconciliation where drift <> 0` | **0 rows** |
| Duplicate `(provider_id, provider_ref)` | **0 groups** |

## Manual / adversarial scenarios still owner-verified
These need real credentials, multiple concurrent sessions or a bank sandbox:
- Live OAuth consent for each provider and account-linking edge cases.
- Real PromptPay scan + bank webhook (provider sandbox/live).
- KBank merchant callback after approval.
- Two simultaneous checkouts for the same last inventory unit (logic uses `SKIP LOCKED`; verify
  under load with a k6/Artillery script).
- Two simultaneous wallet debits (row locks + non-negative constraint).
- Database connection loss mid-transaction (expect full rollback, no partial ledger).
- Expired QR → cron → order cancelled and coupon released.
- Slip rejection → order cancelled → coupon released.
- Supabase RLS with the anon key against `orders`, `wallets`, `product_inventory`,
  `payment_providers` (expect no rows/denied).
- Large file upload (>5 MB) and renamed executable (expect rejection).
- Maintenance mode with a customer session vs staff session.
- Suspended account with an existing session (expect rejection + revoked session).
- Email deliverability (SPF/DKIM/DMARC) once Resend is configured.

## QA checklist

- [ ] Register, verify email, login, logout, reset password.
- [ ] Product search/filter/sort/pagination and stock states.
- [ ] Add/update/remove cart lines; signed cookie rejects tampering.
- [ ] Coupon: valid, expired, below minimum, over per-user limit, wrong products.
- [ ] Checkout: wallet insufficient, wallet success, PromptPay pending, terms required.
- [ ] Payment page: countdown, polling, expired, manual review, paid.
- [ ] Webhook: invalid signature, valid, duplicate, amount mismatch, wrong provider.
- [ ] Wallet: ledger order, refund, admin credit/debit, no negative balance.
- [ ] Delivery: automatic single unit, multi-quantity, concurrent purchase, manual payload,
      credential encryption/reveal permission.
- [ ] Top-up: dynamic fields, invalid pattern, manual completion, failure + refund.
- [ ] Admin: every module loads; permissions enforced by server for support/finance/product roles.
- [ ] Responsive: 360, 390, 768, 1024, 1440 widths; light/dark; TH/EN.
- [ ] All links resolve; no buttons without handlers; empty states show correctly.
- [ ] `npm run typecheck`, `npm test`, `npm run build` pass.
