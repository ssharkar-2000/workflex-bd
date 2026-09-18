# WorkFlex BD — Admin Console

Gig-work marketplace admin app, built from the 101 design frames in
`HelloHiByeBye.zip`.

- **Mobile** — React Native (Expo), TypeScript
- **Backend** — NestJS + Prisma
- **Database** — PostgreSQL 16

```
.
├── docker-compose.yml     Postgres
├── backend/               NestJS API
│   ├── prisma/
│   │   ├── schema.prisma  20 models
│   │   └── seed.ts        the demo data from your mockups
│   └── src/               10 feature modules
└── mobile/                Expo app, 16 screens
```

## Run it

**1. Database**

```bash
docker compose up -d
```

**2. Backend**

```bash
cd backend
cp .env.example .env          # change both JWT secrets
npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev             # http://localhost:3000/api
```

**3. Mobile**

```bash
cd mobile
cp .env.example .env
npm install
npx expo start
```

Sign in with **admin@workflex.bd** / **workflex123**.

On a physical device `localhost` means the phone, not your machine. Set
`EXPO_PUBLIC_API_URL` to your LAN IP, e.g. `http://192.168.1.20:3000/api`.

## Screens built

| Screen | Source frames |
|---|---|
| Dashboard | admin1, admin2 |
| Explore All Workers | admin6, admin7 |
| Worker Profile | admin13, admin19, admin24, admin28 |
| Edit Profile | admin9, admin14, admin25, admin34 |
| Job History | admin10, admin15, admin21, admin35 |
| Jobs (All/Pending/Approved/Featured/Rejected) | admin63–66, admin71–75 |
| Job Details | admin47, admin50, admin53, admin55, admin57 |
| Post a Job | admin68, admin69 |
| Payments | admin38 |
| Transaction Details | admin41, admin42, admin44, admin45 |
| Verification Center | admin76–83 |
| AI Monitoring | admin86, admin88, admin90–98 |
| Alert Details | admin87, admin89, admin91 |
| Analytics | admin39, admin40, admin84, admin85 |
| Complaints & Support | admin3 |
| Notifications | admin4 |
| All Sections menu | admin5 |
| Employer Management | no frame — built to match |
| Company Management + detail | no frame — built to match |
| Attendance | no frame — built to match |
| Reports | no frame — built to match |
| Security (audit log + sessions) | no frame — built to match |
| CMS | no frame — built to match |
| System Management | no frame — built to match |
| Settings | no frame — built to match |

## API

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/auth/sign-in` | POST | Returns access + refresh tokens |
| `/api/auth/refresh` | POST | Rotates the refresh token |
| `/api/auth/sign-out` | POST | Revokes all refresh tokens |
| `/api/admin/me` | GET, PATCH | Profile, display language |
| `/api/dashboard` | GET | Overview cards, worker status, live alerts, notifications |
| `/api/dashboard/analytics` | GET | Revenue + worker series, four KPIs |
| `/api/dashboard/menu-badges` | GET | Badge counts for the menu |
| `/api/workers` | GET | Filter by status, profession, search |
| `/api/workers/status-counts` | GET | Counts for the filter chips |
| `/api/workers/:id` | GET, PATCH | Profile with skills, certs, history |
| `/api/workers/:id/job-history` | GET | Placement history |
| `/api/workers/:id/verify \| suspend \| reinstate` | POST | Status changes |
| `/api/jobs` | GET, POST | Filter by status, category, featured |
| `/api/jobs/status-counts` | GET | Counts for the tab row |
| `/api/jobs/categories`, `/api/jobs/companies` | GET | Post-a-job pickers |
| `/api/jobs/analytics` | GET | Fill rate, views, by-category |
| `/api/jobs/:id` | GET, PATCH | Detail and edit |
| `/api/jobs/:id/approve \| reject \| feature \| unfeature` | POST | Review actions |
| `/api/payments/summary` | GET | The four cards |
| `/api/payments/revenue-series` | GET | Monthly revenue |
| `/api/payments/transactions` | GET | Filter by status, type, search |
| `/api/payments/transactions/:id` | GET | Detail |
| `/api/payments/transactions/:id/refund \| retry` | POST | Refund, retry failed |
| `/api/verifications` | GET | Queue, filter by type and status |
| `/api/verifications/pending-by-type` | GET | The six tiles |
| `/api/verifications/:id/approve \| reject` | POST | Review |
| `/api/alerts` | GET | Sorted by severity then recency |
| `/api/alerts/summary` | GET | AI matches, fraud saved, GPS alerts |
| `/api/alerts/:id/resolve \| escalate` | POST | Alert actions |
| `/api/complaints` | GET, PATCH | Support tickets |
| `/api/notifications` | GET | With unread count |
| `/api/notifications/read-all`, `/:id/read` | POST | Mark read |
| `/api/employers` | GET, POST | Filter by company, verified, search |
| `/api/employers/counts` | GET | Filter chip counts |
| `/api/employers/:id` | GET, PATCH | Detail and edit |
| `/api/companies` | GET, POST | List and create |
| `/api/companies/:id` | GET, PATCH | Detail with employers and recent jobs |
| `/api/attendance` | GET, POST | Day roster; upsert a worker's status |
| `/api/attendance/summary` | GET | Present/late/absent split, GPS flags |
| `/api/reports/summary` | GET | Workforce, hiring, money, trust & safety |
| `/api/reports/transactions.csv` | GET | CSV export for a date window |
| `/api/security/overview` | GET | Sessions, actions, admins, open alerts |
| `/api/security/audit-log` | GET | Every admin action, newest first |
| `/api/security/sessions` | GET | Live sessions |
| `/api/security/sessions/:id/revoke` | POST | Kill a session |
| `/api/cms` | GET, POST | Banners, pages, FAQs |
| `/api/cms/:id` | GET, PATCH, DELETE | Edit, publish, remove |
| `/api/system/health` | GET | DB latency, uptime, row counts |
| `/api/system/settings` | GET | Grouped settings |
| `/api/system/settings/:key` | PATCH | Update one setting |

## Decisions worth knowing

**Money is `BigInt` paisa, never a float.** ৳4.83Cr rendered from a `Float`
accumulates rounding drift across aggregations. The API returns integers;
`mobile/src/theme/format.ts` handles the ৳25,000 / ৳83.1L / ৳4.83Cr display
forms your frames use.

**`featured` is a boolean, not a fifth `JobStatus`.** Your tab row counts
Featured *alongside* Approved rather than instead of it, so a featured job is an
approved job with a flag. Only approved jobs can be featured; rejecting one
clears the flag.

**Every state change writes an `AuditLog` row.** Approve, reject, suspend,
refund, escalate — with the admin, reason, and a metadata blob. Your Alert
Details frame has an "Action Taken" field and the suspend/reject flows all
confirm first, which implies a reviewable trail.

**A global interceptor normalises BigInt and Decimal.** `JSON.stringify` throws
on BigInt, so without it every endpoint touching money would return a 500.

**Analytics read from `DailyMetric` rollups, not raw rows.** Recomputing seven
months of revenue and worker growth from the transaction table on every
dashboard paint won't hold up. A nightly job should write these; the seed
populates them directly.

**Charts are hand-drawn views, not a charting library.** Your charts are simple
bar series, so `components/BarChart` is ~30 lines with no dependency.

## Verified

- `mobile`: `npx tsc --noEmit` — clean.
- `backend`: all 74 files parse clean; full typecheck clean against a shim of
  the generated Prisma client. The sandbox this was built in blocks
  `binaries.prisma.sh`, so the real client couldn't be generated there —
  `npx prisma generate` runs normally on your machine as part of
  `prisma migrate dev`.
- Not run: migrations against a live database, and the app on a device.

## Sections with no design frames

Eight rows in your menu (`admin5`) had no frames behind them. They are now
built, following the visual language of the frames that do exist — same cards,
pills, filter chips, and tokens — rather than inventing a second style.

Three needed new tables, and the shapes are inferences worth reviewing:

- **`AttendanceRecord`** — one row per worker per day, with check-in/out,
  captured GPS, and a `gpsFlagged` boolean. The AI monitoring screens flag
  "fake GPS coordinates detected during check-in", which implies attendance
  captures coordinates and something compares them to the job site.
- **`CmsBlock`** — banners, pages, and FAQs in one table keyed by `kind`, with
  `titleBn` / `bodyBn` alongside the English fields, since the menu offers an
  EN/বাংলা toggle and published content has to exist in both.
- **`SystemSetting`** — key/value with a declared `valueType`, so a new toggle
  is a row rather than a migration. Values coerce back to real booleans and
  numbers at the API boundary.

Security needed no new tables: `AuditLog` was already being written by every
module, and active refresh tokens are the session list.

The design also had ~70 near-duplicate iterations (eight Verification Center
variants, twelve AI Monitoring). Each is implemented once, from the most
complete version.

## Colour note

Primary orange appears as `#ff6b00`, `#ff6600`, and `#ff6000` across your
frames. Standardised on `#FF6B00` in `mobile/src/theme/index.ts` — every colour,
radius, and text style lives there and nothing else hardcodes a value.
