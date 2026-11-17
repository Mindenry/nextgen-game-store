# Payment Setup

This store supports four payment modes behind one internal contract. The storefront never talks to
a provider directly; the server creates and settles payment records.

## What is implemented

| Mode | Create payment | Verify | Notes |
|---|---|---|---|
| **PromptPay QR** (`promptpay_qr`) | EMVCo payload + CRC16 generated server-side | Signed webhook **or** manual slip review | Works with any PromptPay ID. No provider account required to display a QR. |
| **Generic webhook** (`generic_webhook`) | Not used to create a QR; intended for PSP redirects | HMAC-SHA256 required | Provider contract below. |
| **KBank Open API** (`kbank`) | Disabled until merchant approval | Bank callback (HMAC/contract-specific) | Adapter refuses to fake a payment. |
| **Manual transfer** (`manual`) | Bank instructions shown | Staff review of uploaded slip | Always available as a fallback. |

There is no "trust the customer's screenshot" path. A payment becomes `PAID` only via:

1. a valid signed provider webhook, or
2. an explicit staff approval after reviewing evidence.

## 1. PromptPay ID

Set in either place:

- Environment: `PROMPTPAY_ID=0812345678`
- Admin → Settings → Payment settings

Accepted formats: 10-digit mobile (`08…`, `06…`, `09…`), 13-digit national ID, 15-digit e-wallet.
The QR amount is fixed to the payment amount, and a unique reference is embedded in tag 62.

The QR is generated locally; no external API call is required and no fee is assumed. Confirm with
your bank that your account is allowed to receive merchant PromptPay payments and that the
display name/tax ID requirements are met.

## 2. Automatic verification (strongly recommended)

You need a provider that can send a **server-to-server** webhook for incoming PromptPay payments.
Options to evaluate (verify current onboarding, eligibility, pricing and KBank support directly —
none are assumed free):

- PromptPay.dev — <https://promptpay.dev/>
- KBank Developer / Open API — <https://apiportal.kasikornbank.com/>
- Any Thai PSP or payment gateway that supports PromptPay and signed webhooks.

Before subscribing, confirm:

- [ ] Can the business register (jurisdiction, documents)?
- [ ] Is manual approval required, and how long does it take?
- [ ] Is there a monthly/per-transaction fee?
- [ ] Does it support your KBank account as the receiving account?
- [ ] Does the webhook include an HMAC signature and a replay window?
- [ ] Is a transaction history/reconciliation API available?
- [ ] Does it work without an Android device or app interception? (This project never uses
      screen scraping, notification listening, or a phone farm.)
- [ ] What are the amount and reference matching rules?

### Webhook contract

Endpoint:

```
POST https://your-domain.com/api/webhooks/payments/<providerId>
Content-Type: application/json
x-ngs-signature: <hex HMAC-SHA256 of the raw request body using the provider secret>
```

Body:

```json
{
  "reference": "NG250101ABCD1234",
  "amount": 100.00,
  "provider_ref": "PROVIDER-TXN-000123",
  "status": "PAID",
  "event": "payment.paid"
}
```

Rules enforced by the server:

1. Provider must exist and be enabled.
2. Signature must match the stored (encrypted) provider secret, constant-time.
3. Optional IP allow-list (`PAYMENT_WEBHOOK_IP_ALLOWLIST`).
4. Payment reference must exist and belong to the same provider.
5. Amount must equal the payment intent exactly (satang comparison).
6. `provider_ref` must be unique per provider (DB unique index).
7. Duplicate events for an already-paid payment return 200 without crediting twice.
8. A second payment for an already-paid order is flagged `MANUAL_REVIEW`, not credited.
9. Every event is stored in `payment_events` including signature failures.

Responses: `200` accepted/idempotent, `400` malformed, `401` bad signature, `403` disabled/IP,
`404` unknown, `409` amount/duplicate conflict (flagged for review), `503` secret not configured.

### Enabling

1. Admin → Payment Providers → **PromptPay QR** → Configure.
2. Set the webhook secret (encrypted at rest).
3. Keep the provider enabled.
4. Set it as **Active provider** in Settings if it is not already.
5. Configure the provider dashboard to POST to the URL above with signature.

Test locally:

```powershell
$body = '{"reference":"PASTE_REF","amount":50,"provider_ref":"TEST-1","status":"PAID"}'
$secret = "your-secret"
$hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($secret))
$sig = [Convert]::ToHexString($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($body))).ToLower()
Invoke-WebRequest -Uri http://localhost:3000/api/webhooks/payments/promptpay_qr -Method POST -Body $body -Headers @{ "x-ngs-signature" = $sig; "Content-Type" = "application/json" }
```

The E2E suite automates this (valid, invalid, replayed, mismatched amount, duplicate provider ref).

## 3. Manual verification

1. Customer creates a deposit/order with a QR or bank instructions.
2. Customer scans / transfers the exact amount and uploads a slip.
3. Slip is stored privately (`slips/<userId>/…` or a private Supabase path), its SHA-256 is
   recorded, and the payment moves to `MANUAL_REVIEW`.
4. Staff open **Admin → Payments → Slips awaiting review**, compare the amount, destination
   account and reference against the bank statement, then approve or reject with a reason.
5. Approval calls the same settlement service used by webhooks: wallet credit + delivery are
   atomic. The approval is audit logged; rejection cancels an unpaid order and releases the coupon.

Slip uploads are unique by image hash, so the same slip cannot be reused on another payment even
before a provider is configured.

## 3.1 Automatic slip verification (SlipOK)

The store implements a real bank-side slip verification adapter for
[SlipOK](https://slipok.com/api/). Configure it in **Admin → Payment Settings → ตรวจสลิปอัตโนมัติ
(SlipOK)**:

| Field | What to enter |
|---|---|
| Branch ID | The branch ID shown in SlipOK |
| API Key | The API key from SlipOK (encrypted at rest with `ENCRYPTION_KEY`) |
| เติมเงินอัตโนมัติ | Enable only after testing in SlipOK's plan/sandbox |

When enabled, every slip upload is sent to SlipOK with `log=true` and the expected amount. SlipOK:

- reads the slip QR and verifies it is a real bank transaction,
- checks the slip is not already used (`1012`),
- checks the receiving account against the branch registered with SlipOK (`1014`),
- checks the amount (`1013`).

Only a fully verified response credits the wallet. The transaction reference is stored as the
payment's `provider_ref` (unique), the slip hash is unique, and the payment row is locked, so a
replayed or duplicated slip cannot credit twice. Errors, bank delays (`1010`) and unconfigured
credentials leave the payment in `MANUAL_REVIEW` and notify staff — the system never pretends a
slip is genuine.

Without SlipOK credentials, automatic verification is impossible; use manual review against the
bank statement. Do not enable "auto approve" unless SlipOK is configured.

## 3.2 Free self-hosted slip pre-check

The store also decodes the Mini QR printed on a slip **on your own server** (no paid API): it uses
`sharp` + `jsQR`, parses the standard bank / TrueMoney Mini QR TLV, validates the CRC-16/CCITT-FALSE
and extracts the sending bank + transaction reference. It then:

- rejects a slip whose transfer reference was already used on another payment,
- stores the parsed reference for staff,
- keeps the payment in `MANUAL_REVIEW`.

It deliberately does **not** auto-credit. The Mini QR contains only the bank and transaction
reference — it does not contain a bank-verified amount or receiver. A fabricated QR can pass the
structure check, so staff must confirm the reference with the bank statement (or use SlipOK/KBank
for real confirmation). This is the same "pre-check before bank API" purpose documented by
`promptparse-jvm`.

Algorithm references and attribution are in the root `NOTICE` file.

## 3.3 TrueMoney Angpao (manual, phone 0812345678)

The `truemoney_angpao` provider accepts a voucher link from `gift.truemoney.com`:

1. Customer creates a deposit and selects **TrueMoney Angpao (Manual)**.
2. Customer sends/receives the Angpao to the configured shop phone and pastes the voucher link.
3. The voucher code is hashed (unique), the full link is encrypted at rest, and staff are notified.
4. Staff redeem the voucher in the official TrueMoney app, then approve the payment.
5. Approval credits the wallet exactly once.

The store does **not** automate voucher redemption. TrueMoney has no public unauthenticated API for
this; automating it would require OTP/session access and would violate the service terms. If an
official TrueMoney merchant API becomes available, add it as a provider adapter behind the same
`attachVoucher`/approval flow.

Configure the receiving phone in **Admin → Payment Settings → TrueMoney เบอร์รับซองอั่งเปา**.

## 4. KBank

KBank merchant onboarding is required before any API call can work. The adapter intentionally
returns a setup error instead of pretending to succeed. To go live:

1. Apply for the appropriate KBank merchant/business API product.
2. Receive credentials and API documentation (signature scheme, endpoints, sandbox).
3. Add `KBANK_CLIENT_ID`, `KBANK_CLIENT_SECRET`, `KBANK_MERCHANT_ID`, `KBANK_ENV`.
4. Implement the request/response mapping in `src/lib/payments/providers` using the bank's current
   specification, and add contract tests against their sandbox.
5. Configure their callback to `/api/webhooks/payments/kbank` and store the shared secret in the
   provider record.

## 5. Refunds

Order refunds are issued to the customer's **wallet** (atomic ledger entry + audit log). Provider
refunds (money back to the bank account) are intentionally a staff/bank operation: initiate the
bank refund in the provider dashboard, then record it as a refund in the store. Do not mark a
provider refund complete without bank confirmation.

## 6. Required settings summary

| Setting | Where | Purpose |
|---|---|---|
| PromptPay ID | env or Settings | QR recipient |
| Receiver name | Settings | Displayed in admin/instructions |
| Min/max deposit | Settings | Deposit guardrails |
| QR expiry | Settings | Payment intent expiry |
| Active provider | Settings | Provider used for new payments |
| Provider webhook secret | Providers | Encrypts/validates callbacks |
| Manual bank instructions | Providers → manual config | e.g. `{"instructions":"KBank 123-4-56789-0"}` |
| `CRON_SECRET` | env | Expire stale payments |
