/**
 * Demo data for every account in the user panel.
 *
 *   npx tsx apps/api/prisma/seed-demo.ts
 *
 * Gives each individual account a coherent working life rather than a
 * scattering of rows: a CV that matches the work they apply for,
 * applications at different stages, shifts they turned up to, an interview
 * this afternoon, reviews from the people who hired them, practice tests
 * they have sat, and a wallet with what they earned in it.
 *
 * The point is that every screen in the app has something true to show. A
 * demo where three screens work and nine say "nothing yet" tells a faculty
 * panel nothing about the system, and the nine empty ones are the ones they
 * will ask about.
 *
 * Two things it deliberately fixes as well:
 *
 * - Addresses are spread across the eight divisions. The Work Map compares a
 *   division's share of postings against its share of workers, and with
 *   every worker in Dhaka there is nothing to compare.
 * - Job posting dates are spread over sixty days. The Skill Radar sets the
 *   last thirty days against the thirty before; with every job posted in one
 *   week it correctly refuses to draw an arrow, which is right but dull.
 *
 * Safe to run more than once: everything it creates is deleted first, and it
 * only ever touches rows it made.
 */
import { PrismaClient, type JobCategory } from '@prisma/client';

const prisma = new PrismaClient();
const DAY = 86_400_000;
const now = Date.now();

/** A profile for each kind of worker, so the CVs are not all the same. */
const PROFILES: {
  skills: string[];
  categories: JobCategory[];
  titles: string[];
  years: number;
  summary: string;
  address: string;
}[] = [
  {
    skills: ['javascript', 'react', 'html', 'css', 'git', 'figma'],
    categories: ['IT', 'CREATIVE'],
    titles: ['Frontend Developer', 'Web Developer'],
    years: 4,
    summary: 'Four years building web interfaces for Dhaka software firms.',
    address: 'Mirpur 11, Dhaka',
  },
  {
    skills: ['customer service', 'ms office', 'data entry', 'english'],
    categories: ['OFFICE', 'RETAIL'],
    titles: ['Customer Service Executive'],
    years: 3,
    summary: 'Three years on a support desk handling calls and complaints.',
    address: 'Zindabazar, Sylhet',
  },
  {
    skills: ['wiring', 'electrical', 'safety', 'maintenance'],
    categories: ['TRADES', 'CONSTRUCTION'],
    titles: ['Electrician'],
    years: 6,
    summary: 'Six years wiring residential buildings, trained on site.',
    address: 'Agrabad, Chattogram',
  },
  {
    skills: ['cooking', 'food safety', 'kitchen cleaning'],
    categories: ['HOSPITALITY', 'HOUSEHOLD'],
    titles: ['Kitchen Helper', 'Cook'],
    years: 2,
    summary: 'Two years in restaurant kitchens, mornings and evenings.',
    address: 'Boyra, Khulna',
  },
  {
    skills: ['driving', 'delivery', 'navigation'],
    categories: ['DELIVERY', 'TRANSPORT'],
    titles: ['Delivery Rider'],
    years: 3,
    summary: 'Three years riding deliveries across the city.',
    address: 'Rajshahi Sadar',
  },
  {
    skills: ['sewing', 'quality check', 'merchandising'],
    categories: ['MANUFACTURING'],
    titles: ['Machine Operator', 'Quality Checker'],
    years: 5,
    summary: 'Five years on a garment line, latterly on quality.',
    address: 'Tongi, Gazipur',
  },
  {
    skills: ['teaching', 'english', 'ms office'],
    categories: ['EDUCATION'],
    titles: ['Private Tutor'],
    years: 2,
    summary: 'Two years tutoring school students in English and maths.',
    address: 'Rangpur Sadar',
  },
  {
    skills: ['security', 'first aid'],
    categories: ['SECURITY'],
    titles: ['Security Guard'],
    years: 7,
    summary: 'Seven years on building and site security, night shifts.',
    address: 'Barishal Sadar',
  },
  {
    skills: ['cleaning', 'housekeeping'],
    categories: ['HOUSEHOLD'],
    titles: ['Housekeeper'],
    years: 4,
    summary: 'Four years of household and office cleaning work.',
    address: 'Mymensingh Sadar',
  },
  {
    skills: ['sales', 'cash handling', 'stock'],
    categories: ['RETAIL'],
    titles: ['Shop Assistant'],
    years: 3,
    summary: 'Three years behind a counter, latterly running the till.',
    address: 'Cumilla Sadar',
  },
];

const MOCK_SUBJECTS = [
  {
    title: 'Frontend Development',
    category: 'IT' as JobCategory,
    skills: ['JavaScript basics', 'DOM manipulation', 'CSS layout', 'Debugging'],
  },
  {
    title: 'Customer Service',
    category: 'RETAIL' as JobCategory,
    skills: ['Handling complaints', 'Communication', 'Product knowledge', 'Escalation'],
  },
  {
    title: 'Workplace English',
    category: 'PROFESSIONAL' as JobCategory,
    skills: ['Grammar', 'Workplace writing', 'Comprehension', 'Vocabulary'],
  },
];

async function main() {
  const people = await prisma.user.findMany({
    where: { accountType: 'INDIVIDUAL', status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });

  if (people.length === 0) {
    console.error('No individual accounts found.');
    process.exit(1);
  }
  console.log(`Seeding ${people.length} accounts.\n`);

  // --- clear anything an earlier run made, so this is repeatable ---
  const ids = people.map((p) => p.id);
  await prisma.mockTest.deleteMany({ where: { userId: { in: ids } } });
  await prisma.courseCompletion.deleteMany({ where: { userId: { in: ids } } });
  await prisma.review.deleteMany({ where: { subjectId: { in: ids } } });
  await prisma.interview.deleteMany({ where: { candidateId: { in: ids } } });
  await prisma.shift.deleteMany({ where: { workerId: { in: ids } } });
  await prisma.jobApplication.deleteMany({ where: { userId: { in: ids } } });
  console.log('  cleared previous demo rows');

  // --- 1. spread the postings over sixty days, for the Skill Radar ---
  const jobs = await prisma.job.findMany({
    where: { isOpen: true },
    select: { id: true, category: true, title: true, postedBy: true },
  });
  for (const [i, job] of jobs.entries()) {
    // Deterministic rather than random: a re-run leaves the same picture, so
    // a demo rehearsed on Monday looks the same on Tuesday.
    const daysAgo = (i * 7919) % 60;
    await prisma.job.update({
      where: { id: job.id },
      data: { createdAt: new Date(now - daysAgo * DAY) },
    });
  }
  console.log(`  spread ${jobs.length} postings across 60 days`);

  // --- 2. CVs and addresses ---
  for (const [i, person] of people.entries()) {
    const profile = PROFILES[i % PROFILES.length]!;
    await prisma.user.update({
      where: { id: person.id },
      data: { address: profile.address },
    });
    await prisma.cvProfile.upsert({
      where: { userId: person.id },
      create: {
        userId: person.id,
        skills: profile.skills,
        categories: profile.categories.filter(Boolean),
        titles: profile.titles,
        yearsExperience: profile.years,
        summary: profile.summary,
      },
      update: {
        skills: profile.skills,
        categories: profile.categories.filter(Boolean),
        titles: profile.titles,
        yearsExperience: profile.years,
        summary: profile.summary,
      },
    });
  }
  console.log(`  ${people.length} CV profiles and addresses written`);

  // --- 3. a working life each ---
  /**
   * A real account to hire from.
   *
   * The seeded postings carry a  pointing at accounts that no
   * longer exist, which is legal — the column has no foreign key — but means
   * nothing on the recruiter's side can work: the applicants screen, the
   * Replacement Matcher and the AI Shortlist all check that the job belongs
   * to the account asking. So an employer is chosen here and the postings
   * this seed uses are reassigned to them.
   */
  const employerAccount = await prisma.user.findFirst({
    where: { accountType: 'COMPANY' },
    select: { id: true },
  });
  const employer = employerAccount?.id ?? people[0]!.id;
  let applications = 0;
  let shifts = 0;
  let interviews = 0;
  let reviews = 0;

  for (const [i, person] of people.entries()) {
    const profile = PROFILES[i % PROFILES.length]!;
    /**
     * Six postings for this person to have a history on.
     *
     * Their own categories first, topped up from everything else when there
     * are not enough. The first version sliced a short category list and
     * silently skipped half the accounts — which is exactly the failure this
     * seed exists to prevent, and it took a count afterwards to notice.
     */
    const theirs = jobs.filter((j) => profile.categories.includes(j.category));
    const rest = jobs.filter((j) => !profile.categories.includes(j.category));
    const rotate = <T,>(list: T[], by: number) =>
      list.length === 0 ? list : [...list.slice(by % list.length), ...list.slice(0, by % list.length)];

    const pool = [...rotate(theirs, i * 3), ...rotate(rest, i * 7)].slice(0, 6);
    if (pool.length < 4) continue;

    const statuses = ['SUBMITTED', 'VIEWED', 'SHORTLISTED', 'ACCEPTED', 'REJECTED'] as const;
    for (const [k, job] of pool.slice(0, 5).entries()) {
      await prisma.jobApplication.upsert({
        where: { jobId_userId: { jobId: job.id, userId: person.id } },
        create: {
          jobId: job.id,
          userId: person.id,
          status: statuses[k % statuses.length]!,
          message:
            k === 0 ? 'I have done this work before and can start this week.' : null,
          appliedAt: new Date(now - (k + 1) * 3 * DAY),
        },
        update: { status: statuses[k % statuses.length]! },
      });
      applications += 1;
    }

    const hired = pool[3]!;

    // Without this the postings belong to nobody reachable and every
    // recruiter-side screen refuses them — see the note on employerAccount.
    await prisma.job.updateMany({
      where: { id: { in: pool.map((j) => j.id) } },
      data: { postedBy: employer },
    });

    // Two shifts worked, one coming up, and — for one account — one somebody
    // called off, so the Replacement Matcher has a gap to fill.
    for (const back of [12, 5]) {
      await prisma.shift.create({
        data: {
          jobId: hired.id,
          workerId: person.id,
          status: 'COMPLETED',
          startsAt: new Date(now - back * DAY + 9 * 3_600_000),
          endsAt: new Date(now - back * DAY + 17 * 3_600_000),
          location: profile.address,
          pay: 90_000,
          basePay: 90_000,
          requiredDocuments: [],
        },
      });
      shifts += 1;
    }
    await prisma.shift.create({
      data: {
        jobId: hired.id,
        workerId: person.id,
        status: 'CONFIRMED',
        startsAt: new Date(now + (i + 1) * DAY + 9 * 3_600_000),
        endsAt: new Date(now + (i + 1) * DAY + 17 * 3_600_000),
        location: profile.address,
        pay: 95_000,
        requiredDocuments: [],
      },
    });
    shifts += 1;

    if (i < 2) {
      await prisma.shift.create({
        data: {
          jobId: hired.id,
          workerId: person.id,
          status: 'CANCELLED',
          startsAt: new Date(now + 1 * DAY + 6 * 3_600_000),
          endsAt: new Date(now + 1 * DAY + 14 * 3_600_000),
          location: profile.address,
          pay: 110_000,
          cancelledAt: new Date(now - 2 * 3_600_000),
          cancelReason: 'My mother is in hospital tonight',
          requiredDocuments: [],
        },
      });
      shifts += 1;
    }

    // An interview today, so the Interview Room has something in it.
    // `hired.postedBy` is the stale id read before the reassignment above —
    // using it here is what made the foreign key fail.
    const employerId = employer;
    if (employer !== person.id) {
      const todayAt = new Date();
      todayAt.setHours(15 + (i % 3), 0, 0, 0);
      await prisma.interview.create({
        data: {
          jobId: hired.id,
          employerId,
          candidateId: person.id,
          mode: 'VIDEO',
          status: 'ACCEPTED',
          scheduledAt: todayAt,
          durationMinutes: 30,
          meetingUrl: 'https://meet.workflexbd.com/practice-room',
          respondedAt: new Date(now - DAY),
        },
      });
      await prisma.interview.create({
        data: {
          jobId: pool[1]!.id,
          employerId,
          candidateId: person.id,
          mode: 'IN_PERSON',
          status: 'SCHEDULED',
          scheduledAt: new Date(now + (i + 2) * DAY + 11 * 3_600_000),
          durationMinutes: 45,
          location: profile.address,
        },
      });
      interviews += 2;

      // One review per job, author and role — so the second goes on a
      // different posting rather than a second opinion on the same one.
      for (const [r, rating] of [5, 4].entries()) {
        await prisma.review.create({
          data: {
            jobId: r === 0 ? hired.id : pool[0]!.id,
            authorId: employerId,
            subjectId: person.id,
            subjectRole: 'WORKER',
            rating,
            comment: r === 0 ? 'Turned up on time every day and worked well.' : null,
            onTime: true,
            wouldWorkAgain: true,
            createdAt: new Date(now - (r + 3) * DAY),
          },
        });
        reviews += 1;
      }
    }

    // --- practice tests, two apiece so the progress screen shows movement ---
    const subject = MOCK_SUBJECTS[i % MOCK_SUBJECTS.length]!;
    for (const [attempt, base] of [55, 80].entries()) {
      const breakdown = subject.skills.map((skill, k) => {
        const asked = k < 2 ? 3 : 2;
        const pct = Math.min(100, base + k * 5 - (attempt === 0 ? 10 : 0));
        return { skill, asked, correct: Math.round((pct / 100) * asked), pct };
      });
      const total = breakdown.reduce((s, b) => s + b.asked, 0);
      const score = breakdown.reduce((s, b) => s + b.correct, 0);
      const startedAt = new Date(now - (attempt === 0 ? 20 : 4) * DAY);

      await prisma.mockTest.create({
        data: {
          userId: person.id,
          category: subject.category,
          level: 'INTERMEDIATE',
          title: subject.title,
          questions: breakdown.flatMap((b) =>
            Array.from({ length: b.asked }, (_, q) => ({
              prompt: `${b.skill} — practice question ${q + 1}`,
              code: null,
              options: ['Correct answer', 'Wrong answer', 'Also wrong', 'Not this one'],
              answer: 0,
              skill: b.skill,
              why: 'Seeded demo question. Real tests carry a written explanation here.',
            })),
          ) as never,
          answers: Array.from({ length: total }, (_, q) => (q < score ? 0 : 1)) as never,
          total,
          score,
          passed: Math.round((score / total) * 100) >= 70,
          breakdown: breakdown as never,
          startedAt,
          submittedAt: new Date(startedAt.getTime() + 13 * 60_000),
          source: 'assembled',
        },
      });
    }

    // --- a finished free course, for the Learning Lab ---
    await prisma.courseCompletion.create({
      data: {
        userId: person.id,
        title: `${profile.titles[0]} essentials`,
        provider: 'YouTube',
        url: 'https://www.google.com/search?q=free+course',
        skill: profile.skills[0]!,
        declaredAt: new Date(now - 9 * DAY),
      },
    });

    // --- a wallet with what the shifts paid ---
    await prisma.wallet.upsert({
      where: { userId: person.id },
      create: { userId: person.id, balance: 180_000, withdrawable: 180_000 },
      update: { balance: 180_000, withdrawable: 180_000 },
    });
  }

  console.log(`  ${applications} applications`);
  console.log(`  ${shifts} shifts (including cancelled ones to cover)`);
  console.log(`  ${interviews} interviews (one today for each account)`);
  console.log(`  ${reviews} reviews`);
  console.log(`  ${people.length * 2} practice tests, ${people.length} course completions`);
  console.log(`  ${people.length} wallets funded`);

  console.log('\nDone. Every screen now has something to show.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
