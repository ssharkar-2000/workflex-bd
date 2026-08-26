# WorkFlex BD

AI-powered workforce marketplace for Bangladesh. Employers post permanent,
temporary and flexible jobs; workers discover, apply for and manage employment.

**Current state: Phase 0 — the walking skeleton.** One thin slice runs through
every layer (handset → HTTP → auth → Postgres → back) so integration problems
surface now rather than in month three. The domain model is deliberately three
tables; jobs, KYC, attendance and the wallet come next.

## Stack

| Layer    | Choice                                              |
| -------- | --------------------------------------------------- |
| Mobile   | React Native (Expo SDK 54, expo-router, TypeScript)  |
| Backend  | NestJS 11, Prisma 6, PostgreSQL 16 + PostGIS         |
| Shared   | zod schemas used by both sides — one source of truth |
| Infra    | Redis (queues), MinIO/S3 (KYC documents)             |
| Monorepo | npm workspaces + Turborepo                           |

> The project docs specify Flutter + Spring Boot. That was superseded by the
> stack above; the docs still need updating to match.

## Prerequisites

- Node.js 20+
- Docker Desktop (Postgres, Redis, MinIO)
- Expo Go, or a dev client build, on a physical Android/iOS device

## Getting started

```bash
npm install
cp .env.example .env
npm run infra:up
npm run db:migrate -w @workflex/api
npm run build -w @workflex/shared
npm run api:dev
```

In a second terminal:

```bash
npm run mobile:dev
```

Scan the QR code with your phone. The app infers the API URL from the host
Metro is serving on, so a physical device works with no config edit.

- API: `http://localhost:3000/api/v1`
- Swagger (dev only): `http://localhost:3000/api/docs`
- MinIO console: `http://localhost:9001`

### Signing in without an SMS gateway

`SMS_PROVIDER=console` prints the OTP to the API log and returns it as
`devCode`, which the app pre-fills. This is what lets development proceed
while a Bangladeshi SMS gateway account is still being approved — that
approval takes days to weeks and is the usual launch blocker.

The API refuses to start with `NODE_ENV=production` and
`SMS_PROVIDER=console`, so codes can never be logged in production.

## Layout

```
apps/
  api/              NestJS — auth, health (jobs, KYC, wallet to follow)
  mobile/           Expo app — phone → OTP → home
packages/
  shared/           zod schemas + types shared by api and mobile
docs/               product overview and feature specs
```

## Architecture notes

**Roles, not user types.** One `User` account can hold both a worker profile
and a recruiter profile — a restaurant worker who also hires a delivery rider
is normal here. The app has a role switcher rather than separate accounts.

**Verification is a level, not a role.**

| Level | Meaning           | Proof                | Unlocks                            |
| ----- | ----------------- | -------------------- | ---------------------------------- |
| L0    | Phone verified    | SMS OTP              | Browse, build a profile            |
| L1    | Identity verified | NID + selfie match   | Apply, post as an individual, earn |
| L2    | Business verified | TIN + trade licence  | Post as a company, payroll         |

Every gated action checks the level, so a dual-role user verifies once.

**Verification is manual first.** Neither the Election Commission (NID) nor
the NBR (TIN) exposes a public verification API, and trade licences are issued
per city corporation with no central registry. The KYC pipeline is therefore
built around an admin review queue with pluggable auto-verification providers
dropped in later. This makes the admin panel a Phase 1 dependency, not a
Phase 5 nicety.

## Roadmap

| Phase | Scope                                                     |
| ----- | --------------------------------------------------------- |
| 0     | Walking skeleton — **current**                            |
| 1     | Identity & verification: KYC pipeline, admin review queue |
| 2     | Marketplace core: jobs, search, applications, chat        |
| 3     | Work execution: shifts, QR/GPS attendance, ratings        |
| 4     | Money: wallet, ledger, bKash/Nagad/Rocket payouts         |
| 5     | Beta launch: one city, one vertical                       |
| 6+    | AI layer: recommendations, ranking, fraud detection       |

## Security

- OTP codes stored as HMAC-SHA256 with a server-side pepper, never plaintext
- Refresh tokens are opaque, stored as SHA-256 hashes, and rotate on every use;
  replaying a rotated token revokes the whole token family
- Tokens live in the device keystore via `expo-secure-store`, not AsyncStorage
- Auth is on by default — endpoints opt out with `@Public()`, so a forgotten
  decorator fails closed
- NID and TIN documents are personal data: private bucket, encrypted at rest,
  short-lived presigned URLs, and every admin view logged
