# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and the project uses
[semantic versioning](https://semver.org/).

## [1.0.0] — 2026-11-17

First complete release of NEXTGEN GAME STORE.

### Added

- Storefront in Thai and English: catalogue, search, categories, product pages, cart and checkout.
- Account system: email/password sessions, verification, password reset, profile and security pages.
- Wallet with an auditable ledger, PromptPay QR top-ups, refunds and admin adjustments.
- Payments: EMVCo PromptPay QR, signed webhook verification, replay/amount/duplicate protection.
- Slip workflow: private evidence upload, image hash + bank reference de-duplication, staff review queue.
- Free self-hosted slip Mini-QR parser (TLV, CRC-16/CCITT-FALSE, bank + transaction reference).
- Slip verification providers: SlipOK and EasySlip, including EasySlip receiver account-name matching.
- Bank statement reconciliation: CSV import, auto-match by reference/amount/time, manual linking,
  one-time credit, audit trail.
- TrueMoney Angpao (manual voucher redemption to the shop phone) with encrypted voucher links.
- Digital delivery: encrypted inventory, automatic fulfilment, manual game top-ups queue.
- Admin: 24 modules, RBAC, audit log, analytics, staff and role management.
- Docs: installation, payment setup, admin guide, database schema, security, testing.
- Tests: 56 unit tests (Vitest) and 19 end-to-end scenarios (Playwright).
- Demo data seeding and a zero-balance account helper.

### Security

- scrypt password hashing, signed sessions, AES-256-GCM secrets, RLS policies, rate limiting,
  server-side price and payment validation, unique indexes preventing double credit.

[1.0.0]: https://github.com/Mindenry/nextgen-game-store/releases/tag/v1.0.0
