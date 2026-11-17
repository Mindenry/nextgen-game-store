# Admin Guide

Sign in with a staff account and open `/admin`. The sidebar only shows modules your role can use,
and every action is re-checked on the server.

## Daily routine

1. **Overview** — revenue, pending payments, pending orders, failed transactions.
2. **Payments → Slips awaiting review** — verify each transfer against the bank statement:
   amount, reference, destination account, timestamp. Approve or reject with a reason.
3. **Orders** — process manual deliveries; add internal notes; refund when appropriate.
4. **Game Top-Up** — process pending top-up orders, mark completed or failed; refund failures.
5. **Support** — answer tickets; internal notes are hidden from customers.
6. **Audit Logs** — investigate any unexpected change (actor, IP, before/after).

## Products and stock

- Create products under **Products → New product**. Set price, compare-at price, stock mode,
  delivery method and features.
- `inventory` stock is derived from encrypted inventory units. Add units on the product edit page
  with JSON: `[{"username":"…","password":"…","email":"…","notes":"…"}]`.
- The list view never shows credentials. **Inventory → Reveal** decrypts one unit and writes an
  audit entry; only roles with `inventory.reveal` can do this.
- Products with order history are deactivated instead of deleted, preserving delivery records.
- Duplicate copies prices/images/variants but not inventory.

## Categories, banners, promotions, coupons

- Categories support one parent level and ordering.
- Hero banners: the first active banner replaces the default hero copy.
- Promotions appear on the homepage with scheduling.
- Coupons: percentage/fixed, min order, max discount, total/per-user limits, first purchase,
  product/category restrictions. Codes are upper-cased and validated server-side.
  Restriction fields accept comma-separated **slugs**.

## Payments and providers

- **Payment Settings** (sidebar, under Payments) is the dedicated page for the PromptPay ID,
  receiver name, minimum/maximum deposit, QR expiry, active provider, SlipOK verification and a
  live ฿1 test QR.
- **Settings → Payment settings** also links to the dedicated page.
- **Payment Providers** manages enabled channels and encrypted webhook secrets. Never paste
  secrets into the non-secret config JSON.
- If automatic verification is not connected, use the manual flow; never mark paid without bank
  evidence.
- The reconciliation cron expires stale payments every 10 minutes (or per your schedule).

### Slip verification

- Slip uploads are hashed; the same image cannot be reused on another payment.
- **Free self-hosted pre-check:** the server decodes the Mini QR on the slip, validates its CRC and
  extracts the bank + transfer reference. A reused reference is rejected and the reference is shown
  to staff. This is a pre-check only — it cannot prove the transfer exists, so it stays in manual review.
- **SlipOK** is implemented for real bank-side verification. Add the Branch ID + API key under
  Payment Settings, enable verification and auto-approval, then test with a real ฿1 transfer.
- SlipOK confirms: real bank transaction, receiving account, amount and whether the slip was
  already used. Only a successful response credits the wallet.
- Without SlipOK, every slip stays in **MANUAL_REVIEW** until a staff member checks the bank
  statement. The system never auto-credits from an image alone.

### TrueMoney Angpao

- The shop accepts TrueMoney Angpao vouchers to **0812345678** (editable under Payment Settings).
- Customer selects **TrueMoney Angpao (Manual)**, sends the Angpao to the shop phone and pastes the
  `gift.truemoney.com` voucher link.
- The link is encrypted at rest and its voucher code is unique. Staff must redeem it in the
  TrueMoney app first, then approve the payment. Approval credits the wallet.
- Automatic redemption is intentionally not implemented: TrueMoney has no public unauthenticated
  voucher API, and automating it with OTP/session access would breach the service terms.

### Bank reconciliation (the real verification step)

A slip image cannot be verified for free, so crediting is driven by **your bank account**:

1. Export the account statement as CSV from your banking app.
2. Open **Admin → Bank Reconciliation**, choose the bank and import the file.
3. The system stores the incoming credits and matches them to open payments:
   - exact payment reference (`NG…`) inside the transfer description wins;
   - otherwise it matches only when exactly one open payment has the same amount inside the window
     (default 24 hours);
   - several same-amount payments → nothing is guessed, the credit waits under
     **Unmatched incoming credits** for you to pick the right payment.
4. Once matched, the wallet is credited once, the bank row is linked to the payment and the action is
   written to the audit log.

When a customer uploads a slip, the same check runs immediately: if the matching incoming credit is
already imported, the wallet is credited; otherwise the payment stays in `MANUAL_REVIEW` and the
payment page tells the customer that no bank credit was found yet.

Practical rules:

- Amounts must match to the satang. Wrong-amount transfers stay unmatched (link manually or refund).
- Ask customers to include the `NG…` reference in the transfer memo for exact matching.
- Re-importing the same statement never credits twice (deduplicated by bank reference).
- Change the auto-match switch or the time window at the bottom of the import card.

## Wallets

- **Wallets** shows balances and a reconciliation check against the ledger.
- Adjustments require a reason and create `admin_credit`/`admin_debit` ledger entries; the customer
  is notified and the change is audit logged.
- Staff cannot view or set customer passwords.

## Customers

- Search by email/name/username.
- Open a customer for orders, payments, ledger and tickets.
- Suspend revokes active sessions immediately; reactivate to restore access.
- Staff management is separate; only Super Admins can change staff roles or role permissions.

## Game top-up

- Add games with a JSON field schema, e.g.
  `[{"key":"user_id","label":"User ID","required":true,"pattern":"^[0-9]{5,20}$"}]`.
- Add packages (name, price, optional compare-at).
- Customer fields are validated server-side before the order is created.
- Fulfilment is manual until a provider adapter is implemented; mark `COMPLETED` only after the
  top-up is confirmed in the game, `FAILED` with a reason otherwise. Failed orders can be refunded
  to the wallet.

## Support and reviews

- Ticket status: open → pending → resolved/closed. Replies notify the customer; internal notes do
  not.
- Reviews come only from paid order items. Approving a review recalculates the product rating.

## Settings, maintenance and legal

- Maintenance mode blocks the storefront for customers while keeping `/admin` available.
- Registration can be closed without affecting existing accounts.
- Replace the placeholder terms/privacy/refund text before launch.
- Set the store name, contact, socials, logo URL and SEO description here.

## Staff and roles

| Role | Typical access |
|---|---|
| Support | dashboard, orders (view), customers (view), tickets, reviews |
| Finance | payments, manual verification, refunds, wallet adjustments, analytics |
| Product Manager | products, categories, inventory, top-up, coupons, promotions |
| Admin | everything except staff/roles management |
| Super Admin | everything, including staff and role permissions |

Only Super Admin can edit role permissions. Permission changes take effect on the next request;
role changes revoke the member's sessions.

## Pre-launch checklist

- [ ] Remove demo products, demo accounts and demo orders.
- [ ] Set a real PromptPay ID and verify QR with your bank app.
- [ ] Enable a webhook provider or document the manual verification policy.
- [ ] Add real inventory; never sell demo credentials.
- [ ] Replace legal pages and contact details.
- [ ] Create at least one backup Super Admin account.
- [ ] Test a low-value real purchase and a refund.
