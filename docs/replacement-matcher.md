# Replacement Matcher: replacing a hired worker who can no longer do the job

This feature belongs to `apps/api`, `apps/mobile` and `packages/shared`. The flow it adds:

    Shortlisted candidates -> Worker hired -> Worker becomes unavailable -> Employer requests replacement
      -> System shows eligible shortlisted candidates -> Employer selects one -> Assign as Replacement
      -> New worker hired

The shift-based cover screen that was already under the same name (a cancelled shift and who could cover it) is unchanged and now sits below this on the same screen.

## Using it

**Employer.** Menu → *Hire people* → **Replacement Matcher**. Every hired worker on your jobs is listed under their job, with the job's status (Filled / Partly filled / Needs a replacement).

1. On a worker who cannot continue press **Worker unavailable?**, pick why (dropped out, unwell, did not turn up, another reason), add a note if you like and press **Mark as unavailable**. The worker is told in the job conversation.
2. The matcher opens with **Eligible candidates**: people you already shortlisted for this job who are free for the shifts they would take over and whose CV does not plainly fail the posting, best fit first. **Not offered** shows everyone else on the shortlist and why (busy, requirements, blocked you, account not active).
3. Tap a candidate, press **Assign as Replacement** and confirm. They are hired for the job, the old worker is marked replaced and told, and the old worker's coming shifts move to the new one. The job status updates.

The same action is on each person's card in **Hired workers** (*Worker unavailable?* / *Replacement Matcher*), and when a worker reports it themselves the employer gets a message with a button into the matcher.

**Worker.** Menu → *My recruiters* → open the job → **I can't continue this job**. The employer is told. **I'm available again** takes it back until somebody has been assigned.

## Rules the server enforces

- Only people with status *Shortlisted* on that job can be offered. Nobody is hired from strangers.
- Eligible means: account active, has not blocked the employer, no live shift overlapping the shifts they would take over, and the CV does not plainly fail the posting (stated years below what the posting asks for, or a posting that lists what it wants and a CV with none of it that never held the job). What cannot be checked (no CV, years not stated) is flagged, not failed.
- The list is judged again when someone is assigned, so a screen left open cannot assign somebody who has since taken another shift.
- Assigning is one transaction: the old hire closes, the new one opens, the coming shifts move — or nothing happens. Two employers' taps at once give exactly one winner.
- A replaced hire stays an accepted hire (`completedAt` and `replacedAt` are set), so what they were paid and rated keeps counting. They drop out of the employer's working list and the worker's upcoming work.

## What changed

- Migration `20260930180000_hire_replacement` adds nullable columns to `job_applications` (nothing existing changes).
- API: `POST /hires/:jobId/:workerId/unavailable`, `DELETE` the same path, `GET /hires/:jobId/:workerId/replacements`, `POST /hires/:jobId/:workerId/replace`. `GET /hires` and `GET /jobs/mine` now carry the flag and the job's staffing.
- The CV scoring the AI shortlist uses moved to `jobs/applicant-fit.ts`, so the shortlist and the matcher judge fit the same way.
- Notifications are system lines in the job conversation, in the reader's language, delivered live over the chat socket.

## Tests

```sh
npm test -w @workflex/api
```

`hire-replacement.util.spec.ts` covers the eligibility rules, clash detection and the job status. The flow was also run end to end against a real database (66 checks: permissions, every reason someone is left out, refusals, second taps, two employers at once, live delivery, Bangla) and in two browsers (38 checks).
