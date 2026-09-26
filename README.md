# WorkFlex BD

**WorkFlex BD** is a workforce marketplace for Bangladesh, with mobile interfaces for workers and employers, administration tools, and NestJS APIs backed by PostgreSQL.

The repository includes job discovery and applications, employer hiring workflows, onboarding and document verification, notifications, support, and wallet-related modules. Feature availability depends on the application stack and configured services.

## Choose the right application

This repository contains **two separate application stacks** with different dependencies, database schemas, authentication flows, and API prefixes.

| Stack | Frontend | Backend | API prefix | Installation |
|---|---|---|---|---|
| Workspace marketplace | `apps/mobile/` and `apps/admin/` | `apps/api/` | `/api/v1` | npm workspaces from the root |
| Standalone admin console | `mobile/` | `backend/` | `/api` | Install inside each directory |

Use the workspace stack for the worker/employer marketplace. Use the standalone stack for the admin-console screens discussed in [STATUS.md](STATUS.md).

Do not point `mobile/` at `apps/api/` or apply one backend's migrations to the other backend's database. Root npm commands cover `apps/*` and `packages/*`, not the standalone directories.

## Features

### Workspace marketplace

- **Worker and employer onboarding:** account details, document submission, and verification screens.
- **Authentication:** phone OTP flows, login, password recovery, and separate administrator login.
- **Jobs and hiring:** browsing, job details, posting, applications, applicant management, and hired-worker views.
- **Matching:** backend matching functionality and shared recommendation/skill-gap contracts.
- **Communication:** notifications, reports, and support.
- **Wallet interface:** add-money, payment, and withdrawal screens.
- **Administration:** workers, employers, companies, jobs, verification, payments, and reports.

These describe modules and screens present in the source, not a claim that every external integration is production-ready.

### Standalone admin console

The standalone app includes screens for workers, employers, companies, jobs, applicants, interviews, documents, payments, suspicious transactions, support, reports, settings, and English/Bangla presentation.

[STATUS.md](STATUS.md) records development progress and outstanding verification for this stack. Check historical completion notes against current code and local test results.

## Technology stack

| Area | Workspace stack | Standalone stack |
|---|---|---|
| Mobile UI | React Native, Expo Router, TypeScript | React Native, React Navigation, TypeScript |
| Expo dependency | `~56.0.18` | `^57.0.0` |
| API | NestJS 11 | NestJS 10 |
| ORM | Prisma 6 | Prisma 5 |
| Database | PostgreSQL; Docker includes PostGIS | PostgreSQL with a separate Prisma schema |
| Shared code | `@workflex/shared` schemas and types | Separate backend/mobile packages |
| Build orchestration | npm workspaces and Turborepo | Per-directory npm scripts |

Versions reflect the checked-in manifests. Use a compatible Expo client for the selected app.

## Repository map

| Path | Purpose |
|---|---|
| [apps/mobile](apps/mobile) | Worker/employer marketplace app |
| [apps/admin](apps/admin) | Workspace administrator app |
| [apps/api](apps/api) | Marketplace API, Prisma schema, migrations, and tests |
| [packages/shared](packages/shared) | Shared schemas, types, categories, and geography helpers |
| [backend](backend) | Standalone admin backend |
| [mobile](mobile) | Standalone admin mobile app |
| [docker-compose.yml](docker-compose.yml) | Development PostgreSQL/PostGIS, Redis, and MinIO |
| [.env.example](.env.example) | Workspace server configuration template |
| [docs](docs) | Project overview and explanation documents |
| [STATUS.md](STATUS.md) | Development progress and verification notes |
| [.github/workflows/ci.yml](.github/workflows/ci.yml) | Workspace CI checks |

## Prerequisites

- **Node.js 22**, matching CI. The root manifest declares Node `>=20` and `npm@11.13.0`; use compatible Node/npm versions.
- **Git**, or download and extract the repository ZIP.
- **Docker with Compose** for local infrastructure, or an independently configured database.
- A compatible **Expo Go** client or development build for phone testing.

```bash
node -v
npm -v
git --version
docker compose version
```

## Setup A: workspace marketplace

Run these commands from the repository root unless another directory is specified.

### 1. Clone and configure

```bash
git clone https://github.com/ssharkar-2000/workflex-bd.git
cd workflex-bd
```

Copy `.env.example` to `.env`.

Git Bash / macOS / Linux:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Review the values before starting. The template's database settings match the supplied Docker Compose PostgreSQL service.

### 2. Install and initialize

```bash
npm ci
npm run infra:up
npm run db:generate -w @workflex/api
npm run db:deploy -w @workflex/api
```

Wait for the database to become ready before applying migrations. `db:deploy` applies committed migrations; use `npm run db:migrate` when developing a new schema change.

### 3. Start the API

In one terminal:

```bash
npm run api:dev
```

With default development settings:

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/api/docs`

The API binds to `0.0.0.0` so a phone on the same network can reach it.

### 4. Start the marketplace app

In a second terminal, for Expo Go:

```bash
npm run mobile:go
```

For an installed development client:

```bash
npm run mobile:dev
```

For the web development target:

```bash
npm run mobile:web
```

Keep the API terminal running while using the app.

### 5. Optional workspace admin app

```bash
npm run dev -w @workflex/admin
```

Its Expo server uses port **8082**. Provision a local administrator using the API script, replacing the example values:

```bash
npm run admin:create -w @workflex/api -- admin@admin.workflex.com.bd "YOUR_LOCAL_PASSWORD" "Local Admin"
```

The email must match `ADMIN_EMAIL_DOMAIN`. This flow uses email and password rather than phone OTP.

## Testing on a physical phone

1. Connect the phone and computer to the same Wi-Fi network.
2. Start the selected backend and corresponding Expo app.
3. Scan the QR code with the compatible Expo client.
4. Allow the development server through the computer's firewall on your private network.

The workspace mobile app normally infers the API address from Metro's LAN address. To override it, create `apps/mobile/.env`:

```dotenv
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:3000/api/v1
```

Replace the placeholder with the computer's IPv4 address; on Windows, use `ipconfig`. Restart Expo after environment changes.

**A phone's localhost refers to the phone itself.** An Expo tunnel does not automatically expose the backend; the API must be reachable separately.

## Configuration

See [.env.example](.env.example) and [the API environment schema](apps/api/src/config/env.schema.ts) for options and defaults.

| Setting | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection |
| `PORT` | API port; template uses 3000 |
| `JWT_ACCESS_SECRET` | Access-token signing secret |
| `OTP_PEPPER` | Server-side OTP hashing secret |
| `SMS_PROVIDER` / `SMS_LOG_FILE` | SMS delivery or development output |
| `MAIL_PROVIDER` | Email delivery or development output |
| `ADMIN_EMAIL_DOMAIN` | Allowed administrator email domain |
| `EXPO_PUBLIC_API_URL` | Client API URL override |

The template uses file-based SMS and email in development. OTP messages go to the configured SMS log rather than the handset. Resolve relative log paths from the API process's working directory. Keep development OTP exposure disabled outside controlled local testing.

Docker Compose also provisions Redis and MinIO. The inspected workspace `StorageService` currently stores documents on local disk using `STORAGE_DIR`; S3 variables in the template do not establish an S3 upload integration by themselves.

Keep real secrets in local environment files and use separate credentials and provider configuration for deployment.

## Setup B: standalone admin console

Use **backend/** with **mobile/** and a separate database from Setup A.

### 1. Start the standalone backend

From the repository root:

```bash
cd backend
```

Copy its `.env.example` to `.env`. Set `DATABASE_URL` to your standalone database and configure the JWT secrets. The standalone example uses a different database password from the root Docker Compose file; adjust the URL to your actual settings.

```bash
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run start:dev
```

This backend defaults to `http://localhost:3000/api`. Stop the workspace API first, or use another port and update the client URL.

### 2. Start the standalone mobile app

In another terminal, from the repository root:

```bash
cd mobile
```

Copy `.env.example` to `.env` and replace its example address:

```dotenv
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:3000/api
```

Then run:

```bash
npm ci
npm start
```

Use an Expo client compatible with this app's SDK. The backend also provides `npm run prisma:seed`; inspect [the seed source](backend/prisma/seed.ts) before loading demonstration data into a disposable development database.

## Development commands

Run these workspace commands from the repository root:

| Command | Purpose |
|---|---|
| `npm run api:dev` | API watch mode |
| `npm run mobile:go` | Marketplace Expo server |
| `npm run mobile:dev` | Development-client server |
| `npm run mobile:web` | Marketplace web target |
| `npm run build` | Workspace build tasks |
| `npm run typecheck` | Workspace type checks |
| `npm run test` | Workspace test tasks |
| `npm run db:studio` | Prisma Studio |
| `npm run infra:logs` | Infrastructure logs |
| `npm run infra:down` | Stop Compose services |

CI configures build, typecheck, tests, and migration application for the workspace stack. These checks do not cover standalone `backend/` and `mobile/`.

## Troubleshooting

| Problem | Check |
|---|---|
| Node/npm not recognized | Install Node.js and reopen the terminal |
| Database connection fails | Readiness, port, credentials, and `DATABASE_URL` |
| App network error | Correct stack, API prefix, backend port, Wi-Fi, and firewall |
| Incompatible Expo project | Client compatibility with the app manifest |
| OTP does not arrive | Development provider writes to a file or console |
| Prisma model/type errors | Generate the correct backend client and apply its migrations |
| Port 3000 occupied | Run one backend or assign separate ports |
| STATUS.md feature missing | Confirm which stack the note references |

## Project status and contributions

This README is based on the manifests, configuration, application modules, and development notes. It does not certify a fresh end-to-end run. [STATUS.md](STATUS.md) records historical migration, dependency, and type-checking gaps in the standalone stack.

Create a focused branch for contributions, verify the affected stack, and describe the behavior and checks in the pull request. Keep the two database schemas and app dependency trees separate.
