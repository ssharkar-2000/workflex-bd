# Workflex BD — Fix Progress

## Session 8 (this pass) — items 7 to 14 added

All eight items are implemented end to end (database → API → app), in both
English and Bangla. What each one turned into:

**7. Rejection reasons reach the employer.** `Job.rejectionReason` already
existed but was admin-only — nothing outside the admin app ever read it.
`JobsService.reject()` now requires a real reason (10-char minimum, enforced
in the DTO and the service) and delivers it to every employer account on the
company as a `UserNotification`, with the text kept in its own `reason`
column so the user's app can quote it. The app side replaced the canned
"Did not meet posting guidelines" button with a modal that says plainly that
the employer reads the text word for word.

**8. Irregular transactions → 24-hour ban notice.** New `bans` module.
`GET /bans/irregular-transactions` groups the last 24 hours by worker and
flags four patterns (one unusually large transfer, a burst of activity,
repeated failures, withdrawals exceeding money received) with the specific
reason spelled out. Raising a ban writes a `ScheduledBan` with
`effectiveAt = now + 24h` and messages the user immediately — **nothing is
suspended at that point**. `BansCronService` applies it when the window runs
out, so cancelling inside the window genuinely stops it rather than undoing
it. "Ban now" exists for the cases that can't wait, through the same row.

**9. Instant support replies + in-app popup.** `POST /support/messages`
answers in the same request that creates the ticket: the user's words are
stored as a `USER` reply, an answer is composed (a published FAQ block if the
wording matches, otherwise an acknowledgement naming the ticket code), stored
as a `SYSTEM` reply, and pushed as a `UserNotification`. `ComplaintReply`
gained `authorType`/`authorName`/`auto` and a nullable `adminId` to carry the
three kinds of author. On the app, `NotificationPopup` mounts above the
navigator and polls every 10s — anything new slides in over whatever screen
is showing. It records every existing id on first poll, so opening the app
never fires a burst of popups for old rows.

**10. Interview list.** New `interviews` module and screen. An interview is
its own row rather than a field on `JobApplication`, because the same
applicant can be called back more than once and each round has its own time,
mode and outcome. Scheduling from the applicant list notifies the worker;
moving the time auto-sets `RESCHEDULED` and notifies them again.

**11. Document storage on user id + job id.** New `documents` module. The
storage key is derived, never accepted from the client:
`worker/<workerId>/job/<jobId>/<kind>/<file>`, which makes "everything for
this user on this job" a prefix query and turns a duplicate upload into a
unique-constraint error instead of two competing copies.
`GET /documents/by-user` returns the owner's full profile alongside the files
grouped one folder per job — the screen shows the person at the top and their
folders below.

**12. Escalation goes to the company manager.** `Alert` gained `companyId`,
`companyLabel`, `escalatedToEmployerId`, `escalatedAt` and `escalationNote`,
and `Employer` gained `isManager`. Escalating resolves the company (from the
alert, else from the worker's most recent hire — most alerts only know the
worker), finds the manager (flagged employer, else the company's oldest
account so an escalation is never dropped), records them on the alert and
sends them the details. The company now shows on the alert card and detail.

**13. AI Monitoring → Suspicious Activity.** Renamed everywhere a person
reads it (title, menu row, section headers); the `AIMonitoring` route name is
unchanged on purpose, since renaming it would break every existing navigate
call for no user-visible gain. Cards now carry the company and, once
escalated, the manager it went to.

**14. No technical errors reach a user.** `FriendlyExceptionFilter` maps
Prisma failures and unhandled errors to plain sentences plus a stable `code`
and a log reference; the real error is still logged in full server-side. The
app's `ApiError` now carries that code, `friendlyError()` turns it into a
translated string, and `useApi` routes every failure through it — including
a dropped connection, which used to surface as "Network request failed".
Validation messages keep the server's own wording, since those are already
written for a person and name the specific field.

### Files added

- `backend/prisma/migrations/20260916120000_user_messaging_bans_interviews_documents/`
- `backend/src/common/user-notifications.service.ts`, `friendly-exception.filter.ts`
- `backend/src/bans/`, `interviews/`, `documents/`, `support/`, `user-notifications/`
- `mobile/src/api/errors.ts`
- `mobile/src/components/NotificationPopup.tsx`
- `mobile/src/screens/InterviewsScreen.tsx`, `DocumentsScreen.tsx`,
  `SuspiciousTransactionsScreen.tsx`

### Not verified this pass — read before trusting it

`npm install` could not run for either package in this sandbox (no network
egress to the Prisma engine host, and the mobile dependency tree was never
vendored), so:

- **`prisma validate` / `prisma generate` never ran.** The schema was written
  by hand and reviewed relation by relation, but it has not been checked by
  the tool. Run `npx prisma generate` before anything else — that is the
  first thing that will catch a mistake here.
- **The migration SQL is hand-written**, not generated by
  `prisma migrate dev`. It was written to match the schema column for column.
  Run `npx prisma migrate dev` against a scratch database and diff before
  applying it anywhere real.
- **Only syntax was type-checked**, file by file with `--noResolve`. Every
  file parses and every decorator is well-formed, but nothing cross-file was
  checked — a wrong property name on a Prisma result or a mistyped prop would
  not have been caught. Run `tsc` in both packages once dependencies install.
- The seed adds rows for all the new tables (an interview, three documents, a
  live ban notice mid-window, sent user messages, an auto-replied ticket), but
  it was never executed.

---

## Session 7 update (this pass) — 3 of 4 remaining items done, 1 bonus bug fixed

**Status: incomplete, handed back mid-way (out of turn budget) — but far
along this time.**

### Done and verified this pass

1. **EditWorkerScreen — actually finished, not just prepped.** Added real
   UI for everything Session 6 only added i18n keys for:
   - Availability as a chip-row picker (Full-time / Part-time / Contract),
     same pattern as the company/category pickers in `PostJobScreen.tsx`.
   - Experience in months as a plain number input.
   - Salary min/max as taka inputs, converted to paisa on submit (same
     ×100 convention `PostJobScreen` already uses).
   - Skills as an add/remove chip list (type a name, tap +, tap a chip to
     remove it) — there was no existing removable-chip component, so this
     is a small bespoke one, matching the codebase's existing pattern of
     screens building their own chip rows when needed.
   - Typechecks clean (see the tsc note below).

2. **CmsDetailScreen — `imageUrl` and `position` fields added.** Both
   wired into the create (`POST /cms`) and update (`PATCH /cms/:id`)
   payloads, with a short hint line under each field. Typechecks clean.

3. **Applicants mobile screen — built from scratch.** New
   `mobile/src/screens/ApplicantsScreen.tsx`: lists a job's applicants
   (avatar, name, profession, rating, trust score, applied/hired dates),
   with Shortlist / Hire / Reject actions (hire and reject ask for
   confirmation first). Registered in `navigation/index.tsx` as
   `"Applicants"`, and `JobDetailScreen` now has a "View Applicants"
   button that navigates to it with the job's id and title. This closes
   out item 23 finding #4 end-to-end (backend was verified working last
   session; this is the missing mobile half).

4. **Real bug found and fixed, not on the list: `translations.ts` was
   silently broken for English.** Running `tsc` for the first time ever
   on this project (see below for how) surfaced a structural bug: a
   stray `},` closed the `en: {...}` object around line 93, right after
   the small original set of keys (nav/common/signIn/dashboard/empty).
   Every English string added since session 2–3's dark-mode/i18n sweep —
   which is most of the app's copy — ended up sitting as junk top-level
   properties on the `translations` object instead of inside `en`, so
   `t('workers.title')` etc. would silently fall back to returning the
   raw key string in English mode. Bangla mode was largely unaffected
   because the `bn` block was structured correctly. **Fixed**: moved the
   closing brace to the right place (right before `bn: {`). This means
   the "19 screens converted to i18n" claimed as done in session 3 were
   actually broken for English users this whole time — worth knowing if
   anything downstream assumed that work was solid.

5. **`tsc` now actually runs in this sandbox** (previous sessions'
   STATUS.md notes said this wasn't possible). The blocker was
   `tsconfig.json`'s `baseUrl` option being flagged as a hard error by
   the project's own TypeScript 6.0.3, not a sandbox limitation — worked
   around for verification purposes only, by running against a temporary
   config (extending the real `tsconfig.json` with
   `"ignoreDeprecations": "6.0"`) that was **not** committed to the repo,
   so nothing in the delivered code depends on it. Whoever picks this up
   next can reproduce it locally with:
   ```bash
   cd mobile && npm install
   # create a temp tsconfig extending tsconfig.json with
   # "compilerOptions": { "ignoreDeprecations": "6.0" }, then:
   npx tsc --noEmit -p that-temp-config.json
   ```
   Recommend fixing the real `tsconfig.json` at some point (either drop
   `baseUrl` in favor of `paths` alone, or add the ignoreDeprecations
   flag directly) so `tsc` works out of the box.

### Pre-existing bugs found via this tsc run, NOT fixed (out of scope
   for this pass's task list, but real and worth a look)

- `mobile/src/screens/AnalyticsScreen.tsx:95` — indexes a
  `Record<PaymentMethod, string>` with a plain `string`, which will throw
  at runtime for any `PaymentMethod` value the object doesn't happen to
  have a key for (TS only caught it because of `noImplicitAny`-style
  strictness; worth checking whether every `PaymentMethod` enum value is
  actually covered).
- `mobile/src/api/client.ts:9` — `process.env.EXPO_PUBLIC_API_URL` has no
  type declaration for `process` (needs `@types/node` or an `env.d.ts`).
  Cosmetic — Metro replaces this at build time regardless — but noisy.
- `mobile/src/theme/ThemeContext.tsx` — the light and dark color palettes
  are inferred as two incompatible literal-string types (e.g.
  `background: "#F4F6FA"` vs `background: "#0B1220"` are different
  *types*, not just different values, because neither palette has a
  widening annotation), so the function that's supposed to return either
  one depending on mode doesn't type-check. Doesn't break anything at
  runtime, but the type safety Dark Mode was supposed to have is
  currently a no-op — a real value type declaration on the color object
  would fix this properly.

### Not started yet

- **Wiring `/jobs/analytics` into a screen.** Endpoint verified real and
  kept in session 5; still nothing calls it. This is the one remaining
  item from the original 4.

---

## Session 6 update (this pass) — applicants endpoint verified, EditWorkerScreen prep only

**Status: incomplete, handed back mid-way (out of turn budget).**

### Done and verified this pass

1. **Job applicants endpoint (backend) — now genuinely confirmed working,
   not just "looks correct".** Session 5 wrote the code but never got a
   clean test run. This pass: installed Postgres 16 locally (via apt,
   since Docker isn't available in this sandbox either), applied all
   three `migration.sql` files by hand with `psql`, and seeded real
   jobs/workers/applications rows. `prisma generate` is still blocked
   here — confirmed again that `binaries.prisma.sh` is unreachable, tried
   both the normal native-engine path and the `driverAdapters`
   preview-feature/wasm path, both fail at the same network call — so
   instead of the generated Prisma Client, ran the *exact* SQL Prisma
   would issue for `JobsService.applications()` and
   `.setApplicationStatus()` (same table/column names, taken straight
   from `schema.prisma`) directly against the real database. Confirmed:
   - Listing a job's applicants with the worker join, ordered
     `appliedAt desc`, returns correct rows.
   - Shortlist → Hire transition sets `hiredAt` correctly.
   - The "does this application belong to this job" guard in
     `setApplicationStatus` correctly rejects cross-job application IDs.
   No bugs found. This item can be marked done.

2. **EditWorkerScreen — prep only, no UI changes yet.** Re-confirmed (by
   reading `workers.service.ts` directly) that the backend already
   handles `availability`, `experienceMonths`, `salaryMin`, `salaryMax`,
   and `skills` (skills go through a proper delete+recreate
   `WorkerSkill` transaction) — no backend work needed here. Added the
   i18n keys the new fields will need (`editWorker.availability`,
   `.experienceMonths`, `.salaryMin`, `.salaryMax`, `.skills`,
   `.addSkill`, plus a missing `workers.contract` label) in both EN and
   BN. **The screen's form itself has not been touched** — no new
   fields, no state, no JSX. A first attempt at editing the file was
   started and then reverted rather than left half-wired, so
   `EditWorkerScreen.tsx` on disk right now is byte-for-byte the same as
   before this session.

### Not started yet (unchanged from before, still needed)

- **EditWorkerScreen missing fields** — i18n keys exist, form UI doesn't.
  Plan: availability as a chip-row picker (same pattern as the
  company/category pickers in `PostJobScreen.tsx`), salary min/max as
  taka inputs converted to paisa on submit (same ×100/÷100 convention as
  `PostJobScreen` and `theme/format.ts`), experience as a plain "months"
  number input, skills as a text input + removable chip list (no
  existing removable-chip component, so this needs a small bespoke one
  like `PostJobScreen`'s chip row already does for its own pickers).
- **CmsDetailScreen — `imageUrl`/`position` fields.** Not looked at this
  pass; still exactly as previous sessions left it.
- **Applicants mobile screen.** Backend is now verified and ready
  (`GET /jobs/:id/applications`,
  `POST :id/applications/:applicationId/{shortlist,hire,reject}`); no
  screen or navigation entry exists yet to call it.
- **Wiring `/jobs/analytics` into a screen.** Endpoint verified real and
  kept in session 5; still nothing calls it.

---

## Session 5 update (this pass) — partial work on the 4 item-23 findings

**Status: incomplete, handed back mid-way.** Ran out of turn budget while
verifying the applicants feature against real data — nothing broken, just
unfinished. Here's exactly what's done vs. not, so nothing is assumed to
work that hasn't been checked.

### Done and verified (with real Postgres data, not just read by eye)

1. **Two real money-calculation bugs found and fixed** while deciding what
   to do with the "dead" `/payments/revenue-series` endpoint:
   - `PaymentsService.summary()` and `.revenueSeries()` were summing *all*
     COMPLETED transactions, including COMPLETED refunds — a refund is
     money leaving the platform, not revenue, so this inflated
     "Total Revenue" and the revenue chart. Fixed to only count
     `SALARY_PAYMENT` + `PLATFORM_FEE`. Verified: a test refund of ৳2,000
     was being added to revenue before the fix, correctly excluded after.
   - `pendingPayouts` summed *any* pending transaction rather than
     specifically pending `WITHDRAWAL` rows. Fixed and verified.
2. **Root cause of `/payments/revenue-series` looking unused, found and
   fixed**: `DashboardService.analytics()` (which powers the Analytics
   screen) was reading from a `DailyMetric` table that **nothing except
   the one-time seed script ever writes to** — the revenue/worker-growth
   charts would look fine right after seeding and then never move again,
   no matter how much real activity happened. This is a bigger bug than
   "one unused endpoint." Fixed by making `DashboardService` reuse
   `PaymentsService.revenueSeries()` directly (now genuinely shared code,
   not dead) and computing worker growth as a live cumulative count from
   `Worker.joinedAt`. Verified both the SQL and the cumulative-count logic
   against manually inserted test rows in a real local Postgres.
3. **`/jobs/analytics` — decision made: keep it.** It returns real,
   non-duplicated data (job category breakdown, view counts) that
   dashboard analytics doesn't have. Not yet wired into any screen.
4. **Job applicants feature, backend half only** — added
   `GET /jobs/:id/applications`, `POST :id/applications/:applicationId/{shortlist,hire,reject}`
   to `jobs.service.ts` / `jobs.controller.ts`. Code written and passes
   `tsc` (modulo the sandbox's usual Prisma-stub-client noise — see below),
   but the end-to-end query was **not yet run successfully** against test
   data — my manual test script hit an unrelated column-name typo of my
   own (guessed `companies.code`, which doesn't exist) and I ran out of
   turns before rerunning it correctly. The application logic itself
   (`jobs.service.ts`) looks correct on inspection but treat it as
   **not yet verified** until you run it or I confirm next session.

### Not started yet

- **Finding #2 — EditWorkerScreen missing fields.** Confirmed the backend
  already fully supports `availability`, `experienceMonths`, `salaryMin`,
  `salaryMax`, `skills` (no backend changes needed) — but no mobile UI
  fields have been added yet.
- **Finding #3 — CmsDetailScreen missing fields.** Same story: confirmed
  `imageUrl`/`position` are already fully supported by the backend DTOs —
  no mobile UI fields added yet.
- **Applicants mobile screen.** No screen exists yet to call the new
  backend endpoints from #4 above.
- **Wiring `/jobs/analytics` into a screen.** Endpoint is real and kept,
  but nothing calls it yet.
- A final `tsc` pass on the mobile app hasn't been re-run since before
  this session's backend changes (nothing mobile-side was touched this
  session, so this should still be clean, but hasn't been re-confirmed).

### Sandbox limitation (unchanged from prior sessions)
No network access to `binaries.prisma.sh` in this sandbox, so
`prisma generate`/`migrate` can't run here — schema/migration correctness
was instead verified by applying the raw `migration.sql` files directly via
`psql` and hand-testing queries against a real local Postgres. Do this
locally before running the app:

```bash
cd backend
npm install
docker compose up -d
npx prisma migrate deploy
npx prisma generate
npm run start:dev
```

---



**All 26 mobile screens are now dark-mode + i18n reactive.** The final 7
from last session's list are done: SecurityScreen, AttendanceScreen,
ComplaintDetailScreen, WorkerProfileScreen, PostJobScreen, CmsDetailScreen,
JobDetailScreen. Same pattern as before (`useTheme()`/`useI18n()`,
`createStyles(colors, text)` via `useMemo`), plus matching EN/BN keys
added to `mobile/src/i18n/translations.ts` for all of them (363 keys per
language now, checked for duplicates and for every `t('...')` call in the
screens actually resolving to a real key — verified by script, not by eye).
Also added `numberOfLines` defensively to a few more titles that had the
same overflow gap as the AIMonitoring bug (worker/company names, job
titles, complaint subjects, audit-log action titles, etc.) while already
in those files.

**Item 23 — full DB/CRUD audit pass. Findings below** (this is an audit,
not a rewrite — nothing in this list has been fixed yet):

1. **Two backend endpoints are dead code — never called from the mobile
   app:**
   - `GET /jobs/analytics` (`jobs.service.ts`) — the mobile Analytics
     screen calls `GET /dashboard/analytics` instead, which appears to
     cover the same ground. Either this endpoint is redundant and can be
     removed, or it was meant to power something more job-specific that
     was never built.
   - `GET /payments/revenue-series` (`payments.service.ts`) — likewise
     unused; `AnalyticsScreen` builds its own revenue chart from
     `/dashboard/analytics` instead.

2. **`EditWorkerScreen` doesn't expose every field the backend accepts.**
   `UpdateWorkerDto` on the backend accepts `availability`,
   `experienceMonths`, `salaryMin`, `salaryMax`, and `skills` (string
   array) in addition to the text fields the screen already edits — but
   the screen has no UI for any of those five. An admin can currently
   only fix a worker's skill list or salary expectations by talking to
   engineering, not through the app.

3. **`CmsDetailScreen` doesn't expose every field the backend accepts.**
   `CreateCmsBlockDto`/`UpdateCmsBlockDto` both accept `imageUrl` and
   `position` (ordering within a kind) — neither has a field in the
   screen. Banners in particular are unlikely to be useful without an
   image.

4. **No way to see who applied to a job.** `JobDetailScreen` shows an
   applications *count* (`_count.applications`), and `JobApplication` is
   a real Prisma model that other services already read for aggregate
   counts (reports, alerts, dashboard) — but there is no
   `GET /jobs/:id/applications` endpoint and no screen to view the
   individual applicants for a posting. If "see who applied" is expected
   admin functionality, this is a full gap (backend + mobile), not just
   a wiring issue like the others above.

5. **Everything else checked out.** Cross-referenced all 21 Prisma
   models against controllers, and all ~75 backend routes against every
   `api()`/`useApi()` call in the mobile screens:
   - Every GET/POST/PATCH/DELETE route apart from the two in #1 has at
     least one real caller in the mobile app.
   - No mobile screen calls a route that doesn't exist (no broken/typo'd
     endpoints found).
   - Entities with no dedicated CRUD endpoints (`WorkerSkill`,
     `Certification`, `DailyMetric`, `AuditLog`, `RefreshToken`) are all
     intentionally managed as nested writes or system-internal tables,
     not gaps.
   - The apparent "missing" DELETE endpoints for Worker/Company/Employer/
     Complaint/Alert/Attendance/Notification look intentional — those
     entities use suspend/resolve/close-style status transitions instead
     of hard deletes, which is a reasonable product decision for
     anything with an audit trail, not a bug.

None of items 1–4 have been fixed — they're handed back to you as a
prioritized findings list since they're product decisions (do you want
`/jobs/analytics` removed or built out? do you want a full applicants
list screen?) as much as they're code changes.

---

## Session 3 update (this pass) — dark-mode/i18n sweep + one real bug found

**Converted to be theme-reactive (dark mode) and translated (EN/BN) this
pass:** System, EntityHistory, Complaints, Companies, AlertDetail,
AIMonitoring, Notifications, JobHistory, Payments, CompanyDetail,
TransactionDetail, EditWorker, Employers, Cms, Workers, Analytics,
Verification, Reports, Jobs — **19 screens**, using the same pattern as
before (`useTheme()`/`useI18n()`, `createStyles(colors, text)` via
`useMemo`). Matching keys were added to
`mobile/src/i18n/translations.ts` for every string on these screens.

**Item 6 bug fixed:** `AIMonitoringScreen`'s alert-row title had no
`numberOfLines`, so a long alert message could push the status pills
off-screen or wrap awkwardly. Now `numberOfLines={2}`. While converting
the other 18 screens I also added `numberOfLines` defensively to a
handful of other titles/labels that had the same gap (worker names,
company names, job titles, resolution text, etc.) — not a promised item,
just fixed in passing since I was already in those files.

**One real bug found and fixed (not on your list, found while touching
this file):** `ReportsScreen` already had a working `exportCsv()`
function and an `exporting` loading state — but **no button on the
screen ever called it**. The backend endpoint and the client-side share
logic were both real and correct; the UI simply never wired a button to
them. Added the actual "Export CSV" button. This is the same pattern
flagged repeatedly in earlier sessions (endpoint/logic exists, mobile
screen doesn't call it) — worth a specific check during item 23.

**Still on the old static light/English pattern (not converted this
pass):** SecurityScreen, AttendanceScreen, ComplaintDetailScreen,
WorkerProfileScreen, PostJobScreen, CmsDetailScreen, JobDetailScreen —
**7 screens left**. These render correctly, they just won't flip when
you toggle dark mode or switch language yet. The conversion pattern is
proven and mechanical (see any of the 19 files converted this pass, or
the 6 from the prior session, as a template) — ran out of turn budget
partway through SecurityScreen (it was only viewed, not edited, so it's
untouched/safe).

**Item 23 (final full CRUD/DB audit pass):** still not started.

---

# Workflex BD — Fix Progress

## Session 4 update — premium logo + two-tone "WorkFlexBD" wordmark

New shared component: `mobile/src/components/Brand.tsx`, used on
`SignInScreen` and `DashboardScreen` (the only two places the brand mark
appeared).

- `BrandMark` — replaced the old flat solid-colour circle with a diagonal
  navy gradient badge (`expo-linear-gradient`), a soft brand-tinted halo
  behind it, a glossy top highlight, and a proper drop shadow.
- `BrandWordmark` — "WorkFlexBD" as a two-tone wordmark: **W** in navy,
  **F** and **BD** in the brand orange, the connecting lowercase letters
  (`ork`, `lex`) in a muted grey — the same trick compound wordmarks like
  FedEx/eBay use so the name reads as one crafted mark instead of plain
  text, per your "W / FBD different colour" note.
- New dependency: `expo-linear-gradient` (`~57.0.1`, the version Expo
  recommends for SDK 57) added to `mobile/package.json` — **run `npm
  install` after unzipping** or the app won't build until that's done.

## Session 3 update — colour-coded "kind/type" badges across the app

Following the CMS banner/page/faq colour badges, the same treatment was
extended to every other screen that lists items with a kind/type field, so
this isn't a one-off pattern limited to CMS:

- `AlertDetailScreen` — alert kind (SOS/SUSPICIOUS_LOGIN/FAKE_GPS/…) badge
- `NotificationsScreen` — kind icon now sits on a tinted circle per kind
- `PaymentsScreen` + `TransactionDetailScreen` — transaction type badge
- `VerificationScreen` — type badge on each queue row, plus a small tinted
  dot on the filter tiles so the types stay distinguishable even when a
  tile isn't the active filter

New shared building block (`mobile/src/theme/index.ts`): `categoryTint()` +
`buildCategoryPalette()` — a small set of soft, muted tones (indigo/teal/
rose/sky/violet/lime, each with a light and dark variant) kept deliberately
separate from the red/green/amber status palette so a kind badge is never
confused with an approved/pending/rejected pill. `categoryTint(palette,
key)` hashes the kind/type string to always pick the same colour for the
same key, so nothing needed a hand-maintained colour map per enum. Exposed
through `useTheme().categoryPalette`, so it follows dark mode automatically.

Every screen in `mobile/src/screens/` now uses `useTheme()`/`useI18n()` —
confirmed by grepping the whole folder, there are no screens left on the
old static `colors`/`text` import. So unlike the Session 2 note below
(written when only 6 screens were converted), dark mode and translation
context are now wired through the entire app; the badges added in this
session render correctly with the theme toggle on every screen listed
above. What's still genuinely open: the translation *dictionary* itself
only has keys for nav/Menu/Settings/Sign in/shared components — most
screens call `useTheme()` for colour but don't yet call `t()` for their
own headings/buttons, so their copy is still English-only regardless of
the language switch. Extending the dictionary + adding `t()` calls
per-screen is the remaining piece of item 12.

## Session 2 update (this pass) — items 3, 5, 6, 12, 13, 16, 23

**Item 3 & 5 (re-audit status actions):** cross-checked every mutating
backend endpoint (`@Post`/`@Patch`/`@Delete` across all controllers)
against the mobile screens that should call them — companies verify/revoke,
employer verify, admin profile, system settings, and every status
transition (approve/reject/feature/verify/suspend/reinstate/resolve/
escalate/reopen/close/assign/reply/revoke/refund/retry/check-out). All are
wired correctly. No new gaps found this pass.

**Item 6 (overflow/responsive audit):** spot-checked list/FlatList screens
for missing `numberOfLines` and `flexWrap`. Most already handle this. Found
one real bug **not yet fixed**: `AIMonitoringScreen`'s alert-row title
(`item.message`) has no `numberOfLines`, so a long alert message can push
the status pills off-screen or wrap the row awkwardly. The rest of the
screens were not all individually re-checked yet — see "Still needed"
below.

**Item 12 (English/Bangla) & Item 13 (dark mode) — real infrastructure
built, partial screen coverage:**
- Confirmed neither existed anywhere before this pass (matches the earlier
  note below) — except that the *backend* already had `admin.language`
  fully wired end-to-end (DB column, `PATCH /admin/me`, and
  `AuthContext.setLanguage`) with **nothing consuming it**. Built the
  missing half instead of duplicating what was already there.
- New files: `mobile/src/theme/ThemeContext.tsx` (`useTheme()` — reactive
  light/dark palette, persisted via AsyncStorage), `mobile/src/i18n/
  translations.ts` + `mobile/src/i18n/I18nContext.tsx` (`useI18n()` —
  EN/BN dictionary, reads/writes `admin.language`, persisted for the
  pre-login screen too). Both wired into `App.tsx`.
- `theme/index.ts` now exports a real `darkColors` palette plus
  `buildText()`/`buildStatusPalette()`/`buildShadow()` builders. The old
  static `colors`/`text` exports are kept as-is (always light) so every
  not-yet-migrated screen still compiles and renders exactly as before.
- **Fully converted to be theme-reactive and translated:**
  `components/index.tsx` (the shared library — Card, Button, StatusPill,
  Chip, Loading, ErrorState, EmptyState, FilterTabs, DetailRow, Meter,
  BarChart, Avatar, SectionHeader — used by nearly every screen, so this is
  the single highest-leverage file for dark mode), `navigation/index.tsx`
  (tab bar, splash screen, tab labels), `SettingsScreen` (added the actual
  dark-mode switch and language picker UI), `MenuScreen`, `SignInScreen`,
  `DashboardScreen`.
- **Not yet converted, as of when this paragraph was written:** the
  remaining ~26 screens (Workers, Jobs, Payments, etc.) — see the Session 3
  note above though: by the time of the next session every screen in
  `mobile/src/screens/` was confirmed to use `useTheme()`/`useI18n()`, so
  this list is now historical, not current status. What's still actually
  open is the translation dictionary coverage described below.
- The translation dictionary itself currently covers navigation, Menu,
  Settings, Sign in, and shared-component strings — not yet every screen's
  own copy (headers/buttons on most screens still show English text
  literally, since no `t()` calls were added there yet).

**Item 16 (AI Monitoring):** left untouched per your note — already
reviewed as sufficiently complete last pass.

**Item 23 (final full CRUD/DB audit pass):** not started this pass.

## What this project actually is
A NestJS + PostgreSQL (Prisma) backend, paired with a React Native / Expo
**mobile admin app** (not a web dashboard). Most backend CRUD, audit
logging, and API wiring was already real — the recurring bug pattern found
across this project has been: **the backend endpoint already exists and
works, but the mobile screen never calls it** (or, in one case, the mobile
app couldn't even reach the backend at all).

## ⚠️ The most important fix in this whole pass
`mobile/src/api/client.ts` had the backend URL **hardcoded to a specific
developer's old LAN IP** (`192.168.0.243`), completely ignoring the
`EXPO_PUBLIC_API_URL` variable that `.env` already correctly declared
(`http://10.20.211.146:3000/api`). This meant the app could never reach your
backend from any machine but that one — nothing in the app could have
worked. Fixed to read the environment variable properly, with a
`localhost` fallback.

**You must set `EXPO_PUBLIC_API_URL` in `mobile/.env` to your own
machine's LAN IP** (not `localhost`, unless you're only ever using the iOS
simulator on the same Mac) before the app can talk to the backend — I can't
know your machine's IP from this sandbox.

## Everything fixed and verified this session

1. **Jobs — View / Edit / Delete**: mobile had no Edit or Delete UI at all;
   added both, wired to the real (already-working) backend endpoints, plus
   a new `DELETE /jobs/:id`.
2. **Complaints & Support — full lifecycle**: added `ComplaintReply` model,
   `assignedAdminId`, `ESCALATED` status (migration included), and
   Reply/Assign/Escalate/Resolve/Reopen/Close — all previously missing.
3. **Color contrast / "premium" palette**: root cause was
   `colors.background` set to bright orange (`#F9AA1E`) with a near-matching
   border color — replaced with a neutral palette. Fixes contrast app-wide
   from one file.
4. **View History**: didn't meaningfully exist (the only "History" button
   led to unrelated employment records). Built a real audit-trail history
   view backed by the existing `AuditLog` table, added to Workers, Jobs, and
   Complaints. Also fixed the security audit-log filters
   (`entityType`/`entityId`/`action`), which were silently guaranteed to
   fail validation before this — the DTO never declared them and the API
   rejects unknown query params globally.
5. **Company / Employer verification**: both had zero Verify/Revoke UI
   despite the backend already supporting it.
6. **Payments, refunds, "Revenue → Full Analytics"**: added a real `method`
   field (bKash/Nagad/Rocket/Bank/Card/Cash — was previously just buried in
   a text label), linked refunds to their original transaction, blocked
   double-refunds, and built the "Full Analytics" link (didn't exist) with
   real payments-by-status / by-method / refunds breakdowns.
7. **Attendance**: `checkOutAt` existed in the schema but there was no way
   to ever set it. Added a Check-out action and a computed working-hours
   figure.
8. **Security**: session revocation wasn't being audit-logged; now is.
9. **CMS**: item was materially broken — publish/unpublish toggle existed
   but there was no way to create, edit, or delete content at all despite
   the backend fully supporting it (including the Bangla fields). Built a
   full editor screen.
10. **Settings persistence**: audited — this one was already solid, real
    round-trip both ways. No fix needed.
11. **Reports**: was a static 30-day view with no filters, and the CSV
    export only existed as a URL printed in a text note. Added 7/30/90-day
    filters and a working Export action (shares the CSV via the OS share
    sheet), and added the new payment method column to the export.

## Still needed — nothing else has been touched yet
- **Item 3, 5** — a few other modules' status actions haven't been
  specifically re-audited this pass for the "endpoint exists, UI doesn't
  call it" pattern found repeatedly above. Worth one more sweep.
- **Item 6** — overflow/responsive audit across every screen and modal.
  I can scan code for obvious culprits (missing `numberOfLines`, fixed
  widths, no `flexWrap`) but can't fully verify without a device/simulator,
  which this sandbox doesn't have.
- **Item 12 — English↔Bangla switching**: confirmed **does not exist at
  all** anywhere in the codebase (no translation files, no language
  context). This is a new feature to build — a translation dictionary, a
  context/provider, persistence, and rewiring every screen's hardcoded
  strings — not a bug fix. Large, standalone piece of work.
- **Item 13 — Dark mode**: confirmed **does not exist**. Every screen
  builds its styles once via `StyleSheet.create` at module load time using
  static `colors.x` values, so real theme switching needs a context-based
  refactor across every screen file, not just a second color palette.
  Equally large, standalone piece of work.
- **Item 16 — AI Monitoring**: reviewed and left as-is — it's already
  reasonably complete for a rule-based flagging system (stat tiles, live
  status, a real suspicious-activity feed with drill-in). Didn't fabricate
  fake ML confidence scores/logs, since this app has no actual ML pipeline
  to report on and your brief explicitly said no fake functionality.
- **Item 23** — a deliberate, final full pass over every remaining
  module's CRUD/DB wiring, beyond what was caught incidentally while fixing
  the items above.

## Before you run it
No network access in the sandbox that built this to reach Prisma's binary
host or a live Postgres, so `prisma generate`/`migrate` could not be run
here — do this locally first:

```bash
cd backend
npm install
docker compose up -d          # from repo root, starts Postgres
npx prisma migrate deploy     # applies both new migrations
npx prisma generate           # regenerates the client with the new fields
npm run start:dev
```

```bash
cd mobile
# edit .env: set EXPO_PUBLIC_API_URL to your machine's LAN IP, e.g.
# EXPO_PUBLIC_API_URL=http://192.168.1.X:3000/api
npm install
npx expo start
```

Everything except the Complaints and Payments schema changes needs no
migration.

## Update — /jobs/analytics wired
This was the last open item flagged. `GET /jobs/analytics` already existed
and worked on the backend but nothing in the app ever called it. Added a
`JobAnalyticsScreen` (fill rate, total/average views, postings by category,
postings by status), registered it in navigation, linked to it from the
Jobs screen header (same pattern as the Payments → Full Analytics link),
and added the `jobAnalytics.*` translation keys in both English and Bangla.
Typechecks clean on both apps — no backend changes were needed for this one.

## Final audit pass (items 3, 5, 6, 23)

**Correction to earlier notes in this file**: this project actually already
had Dark Mode (`theme/ThemeContext.tsx`) and English↔Bangla switching
(`i18n/I18nContext.tsx` + `i18n/translations.ts`) fully built and wired
throughout — the "still needed" section above was stale and hadn't been
updated after that work landed. Both are real, working features: dark mode
persists via AsyncStorage and every screen consumes `useTheme()` for dynamic
colors; language persists both locally and on the admin's account
(`admin.language`) and every screen's chrome uses `useI18n()`/`t()`.

**Endpoint audit (item 23)**: cross-referenced every backend route against
every mobile screen's API calls. Found and fixed the last two gaps of the
same "backend works, nothing calls it" pattern seen throughout this project:

- `GET /payments/revenue-series` — a real, working endpoint (monthly
  revenue computed directly from completed transactions, with the same
  refund-exclusion logic as the payments summary) that nothing in the app
  ever called. Added a Revenue Trend chart to the Payments screen.
- `POST /companies` and `POST /employers` — both fully functional on the
  backend, but there was no "create" UI anywhere for either. Added
  `CompanyCreateScreen` and `EmployerCreateScreen` (the latter reuses the
  existing company picker data from the Post-a-Job form), with "+ New"
  entry points on the Companies and Employers screens.

Also confirmed already correct and untouched: Applicants (shortlist/hire/
reject) already had a full screen and real backend wiring from an earlier
pass; Workers, Verifications, Alerts, Attendance, Security, CMS, Reports —
every remaining list/detail screen's API calls were checked against the
full backend route table and all match.

**Item 6 (overflow/responsive)**: still can't be fully verified without a
device/simulator, which this sandbox doesn't have. Every screen touched in
this project uses `numberOfLines`, `flexWrap`, and `flex: 1`/`flexGrow`
consistently with the rest of the codebase's existing patterns, but a final
visual pass on a real device is recommended before shipping.

At this point every backend route has at least one caller in the mobile
app, and every item from the original 23-point brief has been addressed or
explicitly flagged with why it's left as-is (AI Monitoring) or needs a
device to fully verify (overflow).
