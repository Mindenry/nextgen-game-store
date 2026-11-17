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

- **Settings → Payment settings** controls the PromptPay ID, receiver name, min/max deposit, QR
  expiry and the active provider.
- **Payment Providers** manages enabled channels and encrypted webhook secrets. Never paste
  secrets into the non-secret config JSON.
- If automatic verification is not connected, use the manual flow; never mark paid without bank
  evidence.
- The reconciliation cron expires stale payments every 10 minutes (or per your schedule).

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
