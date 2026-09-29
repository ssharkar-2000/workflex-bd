# Wallet deposits, transfers and receipts

This feature belongs to `apps/api`, `apps/mobile` and `apps/admin`. The separate `backend` and `mobile` applications do not use these endpoints.

## Setup

From the repository root:

```sh
npm ci
npm run db:generate -w @workflex/api
npm run db:deploy -w @workflex/api
```

The migration (`20260925100000_wallet_manual_deposits_and_qr_transfers`) adds deposit references and makes job fields optional for direct transfers. Back up a production database before normal migration deployment. No existing balances are changed by this migration.

Set the receiving accounts in the server's `.env`:

```dotenv
WALLET_DEPOSIT_NAME=Your receiving account name
WALLET_DEPOSIT_BKASH=
WALLET_DEPOSIT_NAGAD=
WALLET_DEPOSIT_BANK=
```

Fill only the channels you actually accept. Bank details should include the bank, branch and account number. Empty channels are hidden and cannot accept declarations. These details are shown to signed-in users. No real account numbers are committed to this repository.

Restart the API. Reinstall dependencies and rebuild any native development client for the new Expo camera/clipboard modules. Expo Go must match SDK 56. Camera access is requested only when the user chooses to scan; manual wallet ID or phone entry works without it. The web screen offers manual entry.

## User and admin flow

1. **Wallet → Add money → Deposit by bKash, Nagad or bank transfer**: copy a configured receiving account, send money outside WorkFlex, and declare the amount, sender account and transaction reference.
2. **Wallet → Deposits**: see pending, approved or rejected declarations and review notes. A declaration does not increase the balance.
3. In `apps/admin`, open **Payments → Top-ups → PENDING**. Verify the amount and reference against the receiving account statement before approving. Rejection requires a reason. Approval and ledger credit occur atomically. Pending gateway payments cannot be manually approved through this path.
4. **Wallet → Receive**: show the QR. It carries the account's id, which cannot be guessed; the short `WF-3A9C1B` code beside it is for reading out and does not open a wallet on its own, so nobody can walk through numbers to collect names.
5. **Wallet → Scan**: scan a WorkFlex QR or type a phone number, check the displayed recipient and amount, then send. Own-wallet and insufficient-balance transfers are rejected. Retrying the same submitted request uses the same idempotency key.
6. Incoming payments produce an in-app receipt popup on the wallet screen, once per device per payment. This is polling, not OS push notifications; statement history remains available.

Only money earned from work can be withdrawn. Money a person added can pay for work and be sent to others, but not withdrawn.

For development only, `WALLET_AUTO_APPROVE_DEPOSITS=true` credits a declared deposit immediately; the API refuses to start with it on in production.

Gateway top-ups and payments to accepted hires still work. Manual/gateway top-ups remain spendable, not immediately withdrawable. Person-to-person transfers preserve that distinction: they cannot turn topped-up money into withdrawable earnings. Normal verified work payments retain the existing earning rules.

## Validation

```sh
npm run build
npm run typecheck
npm run test
```

`wallet-features.spec.ts` covers pending-only deposits, duplicate references/retries, approval eligibility, self transfers, insufficient funds and preservation of withdrawable funds.

Every migration is applied to an empty database by CI on each pull request. Unit tests use mocked database services; real-device camera checks and live-provider end-to-end payments still require the configured environment.
