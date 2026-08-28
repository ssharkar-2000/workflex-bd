/**
 * Sample job listings, one batch per category.
 *
 * Run with `npm run db:seed:jobs -w @workflex/api`. Safe to re-run: every row
 * it writes is tagged in `postedBy`, so a second run replaces the previous
 * batch instead of stacking duplicates on top of it.
 *
 * These exist so the seeker screens have something to render and so filters
 * can be tested against real rows. They are not fixtures a test asserts on —
 * delete them freely once recruiters are posting.
 */
import { Prisma, PrismaClient, type JobCategory } from '@prisma/client';
import { JOB_CATEGORIES } from '@workflex/shared';

const prisma = new PrismaClient();

/** Marks a row as seeded, so re-running can clear the previous batch. */
const SEED_TAG = '00000000-0000-0000-0000-000000005eed';

const EMPLOYERS: Record<string, string[]> = {
  HOUSEHOLD: ['Nagorik Home Care', 'Shomoy Services', 'Dhaka Home Help'],
  DELIVERY: ['Pathao Courier', 'RedX Logistics', 'Shundarban Parcel'],
  HOSPITALITY: ['Sultan’s Dine', 'Hotel Sarina', 'Cafe Mango'],
  RETAIL: ['Aarong', 'Shwapno', 'Bata Bangladesh'],
  OFFICE: ['Akij Resources', 'BRAC Enterprises', 'Rangs Group'],
  IT: ['Brain Station 23', 'Therap BD', 'Kaz Software'],
  EDUCATION: ['Udvash Academy', 'Mentors’ Learning', 'Bright Tutors BD'],
  TRADES: ['Rahman Electricals', 'Dhaka Plumbing Co.', 'Sheba Technicians'],
  BEAUTY: ['Persona Beauty', 'Farzana Shakil’s Salon', 'Glow Studio BD'],
  HEALTHCARE: ['Square Hospitals', 'Popular Diagnostic', 'Care Nursing BD'],
  CONSTRUCTION: ['Navana Construction', 'Concord Group', 'Sheltech Builders'],
  AGRICULTURE: ['ACI Agribusiness', 'Lal Teer Seed', 'Green Valley Farms'],
  EVENTS: ['Blues Communication', 'Wedding Diaries BD', 'Stage Craft Events'],
  TRANSPORT: ['Uber Bangladesh', 'Shohoz Rides', 'Green Line Transport'],
  MANUFACTURING: ['Pran-RFL Group', 'Beximco Textiles', 'Walton Industries'],
  SECURITY: ['Elite Force Security', 'G4S Bangladesh', 'Nirapotta Guards'],
  PROFESSIONAL: ['Hoda Vasi Chowdhury', 'ACNABIN', 'Legal Counsel BD'],
  CREATIVE: ['Grey Advertising BD', 'Asiatic MCL', 'Frame Studio'],
  VOLUNTEER: ['BRAC', 'Bidyanondo Foundation', 'Red Crescent BD'],
  EMERGENCY: ['Shomoy On-Demand', 'Quick Hands BD', 'Relief Network'],
};

const LOCATIONS = [
  'Gulshan, Dhaka',
  'Dhanmondi, Dhaka',
  'Mirpur, Dhaka',
  'Uttara, Dhaka',
  'Banani, Dhaka',
  'Agrabad, Chattogram',
  'Zindabazar, Sylhet',
  'Rajshahi Sadar',
  'Khulna Sadar',
];

const JOB_TYPES = [
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'TEMPORARY',
  'INTERNSHIP',
  'ONE_TIME',
] as const;

const WORKPLACE = ['ONSITE', 'REMOTE', 'HYBRID'] as const;
const EXPERIENCE = ['ENTRY', 'ONE_TO_THREE', 'THREE_TO_FIVE', 'FIVE_PLUS'] as const;

/** Categories whose work is physically located somewhere, by definition. */
const ALWAYS_ONSITE = new Set([
  'HOUSEHOLD',
  'DELIVERY',
  'HOSPITALITY',
  'TRADES',
  'BEAUTY',
  'CONSTRUCTION',
  'AGRICULTURE',
  'TRANSPORT',
  'MANUFACTURING',
  'SECURITY',
  'EMERGENCY',
]);

const SALARIES = [
  '৳12,000 – ৳18,000 / month',
  '৳18,000 – ৳25,000 / month',
  '৳25,000 – ৳40,000 / month',
  '৳40,000 – ৳70,000 / month',
  '৳600 – ৳900 / day',
  '৳1,200 / shift',
  'Negotiable',
  null,
];

/**
 * Deterministic pseudo-random, seeded off the index.
 *
 * Re-running the seed should produce the same catalogue — otherwise every run
 * reshuffles salaries and deadlines and no screenshot or manual test stays
 * comparable to the last one.
 */
function pick<T>(list: readonly T[], n: number): T {
  return list[n % list.length] as T;
}

async function main() {
  const removed = await prisma.job.deleteMany({ where: { postedBy: SEED_TAG } });
  if (removed.count > 0) {
    console.log(`Cleared ${removed.count} previously seeded jobs`);
  }

  const now = Date.now();
  let n = 0;
  const data: Prisma.JobCreateManyInput[] = [];

  for (const category of JOB_CATEGORIES) {
    const employers = EMPLOYERS[category.key] ?? ['WorkFlex Partner'];

    // Every role in the category gets a posting, so the taxonomy is fully
    // represented and searching for any listed job title finds something.
    category.roles.forEach((role, i) => {
      n += 1;
      const companyName = pick(employers, i);
      const onsiteOnly = ALWAYS_ONSITE.has(category.key);

      data.push({
        title: role,
        description:
          `${companyName} is hiring a ${role.toLowerCase()} in ` +
          `${pick(LOCATIONS, n)}. Apply through WorkFlex BD — the employer ` +
          `will contact shortlisted candidates directly.`,
        companyName,
        postedBy: SEED_TAG,
        category: category.key as JobCategory,
        jobType: pick(JOB_TYPES, n),
        workplaceType: onsiteOnly ? 'ONSITE' : pick(WORKPLACE, n),
        experienceLevel: pick(EXPERIENCE, n),
        location: pick(LOCATIONS, n),
        salaryRange: pick(SALARIES, n),
        // 5 to 45 days out, so "days left" varies across the list.
        deadline: new Date(now + ((n % 41) + 5) * 86_400_000),
      });
    });
  }

  const created = await prisma.job.createMany({ data });
  console.log(`Seeded ${created.count} jobs across ${JOB_CATEGORIES.length} categories`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
