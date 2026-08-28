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

const PLACES = [
  { area: 'Gulshan, Dhaka', division: 'DHAKA', district: 'Dhaka' },
  { area: 'Dhanmondi, Dhaka', division: 'DHAKA', district: 'Dhaka' },
  { area: 'Mirpur, Dhaka', division: 'DHAKA', district: 'Dhaka' },
  { area: 'Uttara, Dhaka', division: 'DHAKA', district: 'Dhaka' },
  { area: 'Tongi, Gazipur', division: 'DHAKA', district: 'Gazipur' },
  { area: 'Agrabad, Chattogram', division: 'CHATTOGRAM', district: 'Chattogram' },
  { area: "Cox's Bazar Sadar", division: 'CHATTOGRAM', district: "Cox's Bazar" },
  { area: 'Zindabazar, Sylhet', division: 'SYLHET', district: 'Sylhet' },
  { area: 'Rajshahi Sadar', division: 'RAJSHAHI', district: 'Rajshahi' },
  { area: 'Khulna Sadar', division: 'KHULNA', district: 'Khulna' },
  { area: 'Barishal Sadar', division: 'BARISHAL', district: 'Barishal' },
  { area: 'Rangpur Sadar', division: 'RANGPUR', district: 'Rangpur' },
  { area: 'Mymensingh Sadar', division: 'MYMENSINGH', district: 'Mymensingh' },
] as const;

const JOB_TYPES = [
  'FULL_TIME',
  'PART_TIME',
  'PERMANENT',
  'CONTRACT',
  'FREELANCE',
  'INTERNSHIP',
  'TEMPORARY',
  'SEASONAL',
  'SHIFT_BASED',
  'ONE_TIME',
] as const;

const PAYMENT_TYPES = [
  'HOURLY',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'FIXED_PROJECT',
  'NEGOTIABLE',
] as const;

const WORKING_TIMES = ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'FLEXIBLE'] as const;
const HOURS_BANDS = ['H2_3', 'H4_6', 'H6_8', 'H8_PLUS'] as const;
const DURATIONS = [
  'ONE_TIME',
  'ONE_DAY',
  'FEW_DAYS',
  'ONE_WEEK',
  'ONE_MONTH',
  'THREE_TO_SIX_MONTHS',
  'LONG_TERM',
] as const;
const URGENCIES = [
  'IMMEDIATE',
  'WITHIN_24H',
  'WITHIN_3_DAYS',
  'THIS_WEEK',
  'NONE',
  'NONE',
  'NONE',
] as const;

/**
 * Pay bands per cadence, so an hourly job is not seeded at ৳40,000 an hour.
 * Realistic Bangladeshi figures, low to high.
 */
const PAY_BANDS: Record<string, [number, number][]> = {
  HOURLY: [[80, 150], [150, 300], [300, 600]],
  DAILY: [[500, 900], [900, 1500], [1500, 2500]],
  WEEKLY: [[3000, 6000], [6000, 10000]],
  MONTHLY: [[12000, 18000], [18000, 25000], [25000, 40000], [40000, 70000]],
  FIXED_PROJECT: [[5000, 15000], [15000, 50000]],
  NEGOTIABLE: [],
};

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

/**
 * Requirement and benefit lines, drawn from what postings in this market
 * actually ask for and offer. Kept as bullet text rather than structured
 * fields — a recruiter writes prose, and the detail screen renders it as-is.
 */
const REQUIREMENTS = [
  ['• Minimum SSC / HSC pass', '• Punctual and presentable', '• Able to start immediately', '• National ID required'].join('\n'),
  ['• Relevant experience in a similar role', '• Basic Bangla and English', '• Comfortable working in a team', '• National ID required'].join('\n'),
  ['• Prior experience preferred but not essential', '• Willing to work flexible hours', '• Own transport an advantage', '• Two references'].join('\n'),
  ['• Graduate in any discipline', '• Good communication skills', '• Familiar with MS Office', '• National ID and academic certificates'].join('\n'),
  ['• Physically fit for the work involved', '• Reliable and honest', '• Local to the area preferred', '• National ID required'].join('\n'),
];

const BENEFITS = [
  ['• Payment on completion, via bKash or cash', '• Lunch provided', '• Friendly working environment'].join('\n'),
  ['• Weekly payment', '• Transport allowance', '• Overtime paid at agreed rate'].join('\n'),
  ['• Monthly salary with two festival bonuses', '• Paid weekly holiday', '• Annual increment based on performance'].join('\n'),
  ['• Flexible working hours', '• Work-from-home options where the role allows', '• Performance bonus'].join('\n'),
  ['• On-the-job training provided', '• Opportunity for permanent placement', '• Payment through the WorkFlex BD wallet'].join('\n'),
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

      const place = pick(PLACES, n);
      const paymentType = pick(PAYMENT_TYPES, n);
      const band = pick(PAY_BANDS[paymentType] ?? [], n);
      const duration = pick(DURATIONS, n);

      // Short engagements are the ones people need filled at short notice; a
      // long-term permanent hire is almost never urgent. Correlating the two
      // keeps the seeded catalogue plausible when both filters are applied.
      const shortJob = ['ONE_TIME', 'ONE_DAY', 'FEW_DAYS'].includes(duration);

      data.push({
        title: role,
        description:
          `${companyName} is hiring a ${role.toLowerCase()} in ` +
          `${place.area}. Apply through WorkFlex BD — the employer ` +
          `will contact shortlisted candidates directly.`,
        companyName,
        postedBy: SEED_TAG,
        category: category.key as JobCategory,

        jobType: pick(JOB_TYPES, n),
        workplaceType: onsiteOnly ? 'ONSITE' : pick(WORKPLACE, n),
        experienceLevel: pick(EXPERIENCE, n),

        location: place.area,
        division: place.division,
        district: place.district,

        paymentType,
        salaryMin: band?.[0] ?? null,
        salaryMax: band?.[1] ?? null,

        workingTime: pick(WORKING_TIMES, n),
        hoursBand: pick(HOURS_BANDS, n),
        duration,
        urgency: shortJob ? pick(URGENCIES, n) : 'NONE',

        // Short work starts within days; longer roles are open-ended.
        startDate: shortJob
          ? new Date(now + (n % 7) * 86_400_000)
          : null,
        flexibleStart: !shortJob,

        requirements: pick(REQUIREMENTS, n),
        benefits: pick(BENEFITS, n),
        // Every fourth posting leaves it unsaid, which is realistic and gives
        // the detail screen its "Not specified" case to render.
        vacancies: n % 4 === 0 ? null : (n % 6) + 1,

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
