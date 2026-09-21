/**
 * Seeds the database with the exact sample data shown in the design frames, so
 * the app renders the screens you designed rather than empty states.
 * Money is in paisa: ৳25,000 -> 2_500_000.
 */
import {
  AlertKind,
  AttendanceStatus,
  CmsBlockKind,
  SettingType,
  AlertSeverity,
  AlertStatus,
  Availability,
  ComplaintStatus,
  JobStatus,
  JobUrgency,
  NotificationKind,
  PrismaClient,
  TransactionStatus,
  TransactionType,
  VerificationStatus,
  VerificationType,
  WorkerStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const taka = (amount: number) => BigInt(amount * 100);
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5);
const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

async function main() {
  // Order matters — children first.
  await prisma.auditLog.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.cmsBlock.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.jobApplication.deleteMany();
  await prisma.job.deleteMany();
  await prisma.jobCategory.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.verificationRequest.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.certification.deleteMany();
  await prisma.workerSkill.deleteMany();
  await prisma.jobHistoryEntry.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.employer.deleteMany();
  await prisma.company.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.dailyMetric.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.adminUser.deleteMany();

  // -------------------------------------------------------------------------
  // Admin — matches the "Super Admin / admin@workflex.bd" card on the menu.
  // -------------------------------------------------------------------------
  await prisma.adminUser.create({
    data: {
      email: 'admin@workflex.bd',
      passwordHash: await argon2.hash('workflex123'),
      displayName: 'Super Admin',
      role: 'SUPER_ADMIN',
    },
  });

  // -------------------------------------------------------------------------
  // Companies
  // -------------------------------------------------------------------------
  const companyData = [
    { name: 'Radisson Blu Dhaka', initials: 'R', industry: 'Hospitality', address: 'Kemal Ataturk Ave, Dhaka' },
    { name: 'Pathao Courier', initials: 'P', industry: 'Logistics', address: 'Dhaka City' },
    { name: 'Bashundhara Group', initials: 'B', industry: 'Conglomerate', address: 'Baridhara, Dhaka' },
    { name: 'Square Hospitals Ltd.', initials: 'S', industry: 'Healthcare', address: 'Panthapath, Dhaka' },
    { name: 'Dhaka Electric Supply Co.', initials: 'D', industry: 'Utilities', address: 'Motijheel, Dhaka' },
    { name: 'Navana Construction', initials: 'N', industry: 'Construction', address: 'Tejgaon, Dhaka' },
    { name: 'American Club Dhaka', initials: 'A', industry: 'Hospitality', address: 'Gulshan, Dhaka' },
    { name: 'City Tech Solutions', initials: 'C', industry: 'Technology', address: 'Banani, Dhaka' },
  ];
  const companies = Object.fromEntries(
    await Promise.all(
      companyData.map(async (c) => [c.name, await prisma.company.create({ data: { ...c, verified: true } })] as const),
    ),
  );

  await prisma.employer.createMany({
    data: [
      { code: 'EM-001', fullName: 'Nadia Hussain', email: 'nadia@radissondhaka.com', companyId: companies['Radisson Blu Dhaka'].id, verified: true },
      { code: 'EM-002', fullName: 'Tanvir Ahmed', email: 'tanvir@pathao.com', companyId: companies['Pathao Courier'].id, verified: true },
      { code: 'EM-003', fullName: 'Shirin Akter', email: 'shirin@squarehospitals.com', companyId: companies['Square Hospitals Ltd.'].id, verified: true },
      { code: 'EM-004', fullName: 'Imran Chowdhury', email: 'imran@citytech.com.bd', companyId: companies['City Tech Solutions'].id, verified: false },
    ],
  });

  // -------------------------------------------------------------------------
  // Workers — the six profiles from "Explore All Workers"
  // -------------------------------------------------------------------------
  const workerSeed = [
    {
      code: 'WK-001', fullName: 'Md. Rafiqul Islam', initials: 'MR', profession: 'Electrician',
      status: WorkerStatus.ACTIVE, experienceMonths: 51, rating: 4.8, reviewCount: 156,
      trustScore: 92, totalJobs: 38, completionRate: 95, totalEarnings: taka(1_140_000),
      salaryMin: taka(30_000), salaryMax: taka(38_000),
      phone: '+880 1711-223344', email: 'rafiqul@email.com',
      address: 'House 12, Road 5, Block C, Mirpur-12, Dhaka-1216',
      bio: 'Licensed electrician with industrial panel experience. Reliable on high-load installations and emergency callouts.',
      education: 'SSC, Mirpur Govt. High School (2010)',
      lastCompany: 'Dhaka Electric Supply Co.',
      skills: ['Electrical Wiring', 'Panel Installation', 'Generator Repair', 'Circuit Testing'],
      certs: [{ name: 'Electrical Safety Cert.', issuer: 'BTEB', year: 2019 }],
    },
    {
      code: 'WK-002', fullName: 'Sultana Begum', initials: 'SB', profession: 'Housekeeping',
      status: WorkerStatus.ACTIVE, experienceMonths: 37, rating: 4.6, reviewCount: 189,
      trustScore: 85, totalJobs: 24, completionRate: 93, totalEarnings: taka(32_700),
      salaryMin: taka(18_000), salaryMax: taka(25_000),
      phone: '+880 1811-445566', email: 'sultana@email.com',
      address: 'Flat 3B, Building 7, Mohammadpur Housing, Dhaka-1207',
      bio: 'Professional housekeeper with hotel-standard training. Diligent, trustworthy, and experienced in both household and commercial environments.',
      education: 'JSC, Mohammadpur Girls School (2008)',
      lastCompany: 'Radisson Blu Dhaka',
      skills: ['Deep Cleaning', 'Laundry & Ironing', 'Kitchen Sanitation', 'Guest Room Prep'],
      certs: [
        { name: 'Hotel Housekeeping Cert.', issuer: 'NHTTI', year: 2021 },
        { name: 'Food Safety Awareness', issuer: 'BSTI', year: 2022 },
      ],
    },
    {
      code: 'WK-003', fullName: 'Karim Uddin', initials: 'KU', profession: 'Plumber',
      status: WorkerStatus.PENDING, experienceMonths: 32, rating: 4.2, reviewCount: 61,
      trustScore: 74, totalJobs: 15, completionRate: 87, totalEarnings: taka(280_000),
      salaryMin: taka(20_000), salaryMax: taka(26_000),
      phone: '+880 1911-667788', email: 'karim@email.com',
      address: 'Road 14, Sector 7, Uttara Model Town, Dhaka-1230',
      bio: 'Plumber specialising in residential bathroom fit-outs and leak diagnostics.',
      education: 'SSC, Uttara High School (2013)',
      lastCompany: 'Navana Construction',
      skills: ['Pipe Fitting', 'Leak Repair', 'Bathroom Installation', 'Water Pump Service'],
      certs: [],
    },
    {
      code: 'WK-004', fullName: 'Farida Khatun', initials: 'FK', profession: 'Cook',
      status: WorkerStatus.ACTIVE, experienceMonths: 77, rating: 4.9, reviewCount: 243,
      trustScore: 96, totalJobs: 47, completionRate: 98, totalEarnings: taka(1_880_000),
      salaryMin: taka(40_000), salaryMax: taka(50_000),
      phone: '+880 1611-889900', email: 'farida@email.com',
      address: 'House 45, Road 11, Gulshan-2, Dhaka-1212',
      bio: 'Head cook with club and fine-dining experience across Bangladeshi and continental menus.',
      education: 'HSC, Gulshan Model College (2006)',
      lastCompany: 'American Club Dhaka',
      skills: ['Bangladeshi Cuisine', 'Continental Cooking', 'Pastry & Baking', 'Menu Planning', 'Bulk Prep'],
      certs: [{ name: 'Professional Culinary Cert.', issuer: 'NHTTI', year: 2018 }],
    },
    {
      code: 'WK-005', fullName: 'Jahangir Alam', initials: 'JA', profession: 'Driver',
      status: WorkerStatus.SUSPENDED, availability: Availability.PART_TIME,
      experienceMonths: 14, rating: 3.8, reviewCount: 34,
      trustScore: 62, totalJobs: 11, completionRate: 72, totalEarnings: taka(198_000),
      salaryMin: taka(18_000), salaryMax: taka(22_000),
      phone: '+880 1511-112233', email: 'jahangir@email.com',
      address: 'Lane 3, Mugda Para, Jatrabari, Dhaka-1204',
      bio: 'Heavy vehicle driver. Suspended pending review of a login anomaly.',
      education: 'SSC, Jatrabari High School (2015)',
      lastCompany: 'Pathao Courier',
      skills: ['Heavy Vehicle', 'City Navigation', 'Defensive Driving'],
      certs: [{ name: 'Professional Driving Licence', issuer: 'BRTA', year: 2020 }],
    },
    {
      code: 'WK-006', fullName: 'Rekha Rani Das', initials: 'RR', profession: 'Nurse',
      status: WorkerStatus.ACTIVE, experienceMonths: 67, rating: 4.7, reviewCount: 201,
      trustScore: 89, totalJobs: 52, completionRate: 96, totalEarnings: taka(2_340_000),
      salaryMin: taka(45_000), salaryMax: taka(55_000),
      phone: '+880 1711-334455', email: 'rekha@email.com',
      address: 'House 22, Road 4/A, Dhanmondi, Dhaka-1205',
      bio: 'Registered nurse with ward and home-care experience.',
      education: 'Diploma in Nursing, Dhaka Nursing College (2017)',
      lastCompany: 'Square Hospitals Ltd.',
      skills: ['Patient Care', 'IV Administration', 'Wound Dressing', 'Vitals Monitoring', 'Elderly Care'],
      certs: [{ name: 'Registered Nurse Licence', issuer: 'BNMC', year: 2018 }],
    },
  ];

  const workers: Record<string, { id: string }> = {};
  for (const w of workerSeed) {
    const { skills, certs, rating, ...rest } = w;
    const created = await prisma.worker.create({
      data: {
        ...rest,
        rating,
        joinedAt: daysAgo(rest.experienceMonths * 3),
        skills: { create: skills.map((name) => ({ name })) },
        certifications: { create: certs },
        jobHistory: {
          create: [
            {
              company: rest.lastCompany,
              role: rest.profession,
              startedAt: daysAgo(730),
              endedAt: daysAgo(150),
            },
          ],
        },
      },
    });
    workers[w.code] = created;
  }

  // -------------------------------------------------------------------------
  // Job categories and jobs — the review queue and category chips
  // -------------------------------------------------------------------------
  const categorySeed = [
    { slug: 'corporate', name: 'Corporate', icon: '🏢' },
    { slug: 'administration', name: 'Administration', icon: '📋' },
    { slug: 'security', name: 'Security', icon: '🔒' },
    { slug: 'healthcare', name: 'Healthcare', icon: '🩺' },
    { slug: 'transport', name: 'Transport', icon: '🚚' },
    { slug: 'homemade-work', name: 'Homemade Work', icon: '🧑‍🍳' },
  ];
  const categories = Object.fromEntries(
    await Promise.all(
      categorySeed.map(async (c) => [c.slug, await prisma.jobCategory.create({ data: c })] as const),
    ),
  );

  const jobSeed = [
    {
      code: 'JOB-0001', title: 'Commercial Clerk', category: 'administration', company: 'Radisson Blu Dhaka',
      location: 'Radisson Blu Dhaka · Kemal Ataturk Ave, Dhaka',
      description: 'Commercial clerk needed to handle invoices, purchase orders, and vendor communications for our hotel procurement department. Must be proficient with spreadsheets and comfortable coordinating with suppliers.',
      salaryMin: taka(18_000), salaryMax: taka(25_000), experienceMonths: 12,
      status: JobStatus.PENDING, urgency: JobUrgency.URGENT, postedAt: minutesAgo(300), views: 84,
    },
    {
      code: 'JOB-0002', title: 'Delivery Executive', category: 'transport', company: 'Pathao Courier',
      location: 'Pathao Courier · Dhaka City',
      description: 'Delivery executives needed across all zones of Dhaka city. Must own a motorcycle and hold a valid driving license. Incentive-based earning model on top of base pay.',
      salaryMin: taka(20_000), salaryMax: taka(30_000), experienceMonths: 6,
      availability: Availability.PART_TIME,
      status: JobStatus.PENDING, urgency: JobUrgency.URGENT, postedAt: minutesAgo(480), views: 152,
    },
    {
      code: 'JOB-0003', title: 'Security Guard', category: 'security', company: 'Bashundhara Group',
      location: 'Bashundhara Group · Baridhara, Dhaka',
      description: 'Night-shift security guards for a residential complex. Responsibilities include gate control, visitor logging, and hourly patrol rounds.',
      salaryMin: taka(15_000), salaryMax: taka(20_000), experienceMonths: 12,
      status: JobStatus.APPROVED, postedAt: daysAgo(3), views: 310, featured: true,
    },
    {
      code: 'JOB-0004', title: 'Commercial Cook', category: 'homemade-work', company: 'American Club Dhaka',
      location: 'American Club Dhaka · Gulshan, Dhaka',
      description: 'Commercial cook for club dining. Continental and Bangladeshi menus, bulk preparation, and strict food-safety compliance.',
      salaryMin: taka(35_000), salaryMax: taka(45_000), experienceMonths: 36,
      status: JobStatus.APPROVED, postedAt: daysAgo(5), views: 428, featured: true,
    },
    {
      code: 'JOB-0005', title: 'Cleaning Staff', category: 'homemade-work', company: 'Square Hospitals Ltd.',
      location: 'Square Hospitals Ltd. · Panthapath, Dhaka',
      description: 'Hospital cleaning staff for ward and corridor sanitation. Training on clinical hygiene protocols provided.',
      salaryMin: taka(14_000), salaryMax: taka(18_000), experienceMonths: 0,
      status: JobStatus.REJECTED, rejectionReason: 'Salary below the platform minimum for healthcare postings.',
      reviewedAt: daysAgo(2), postedAt: daysAgo(6), views: 61,
    },
    {
      code: 'JOB-0006', title: 'Home Cooking & Meal Prep', category: 'homemade-work', company: 'City Tech Solutions',
      location: 'City Tech Solutions · Banani, Dhaka',
      description: 'Daily lunch preparation for a 25-person office. Menu planning, grocery coordination, and kitchen upkeep.',
      salaryMin: taka(22_000), salaryMax: taka(28_000), experienceMonths: 24,
      status: JobStatus.APPROVED, postedAt: daysAgo(8), views: 197,
    },
  ];

  const jobs: Record<string, { id: string }> = {};
  for (const j of jobSeed) {
    const { category, company, ...rest } = j;
    jobs[j.code] = await prisma.job.create({
      data: { ...rest, categoryId: categories[category].id, companyId: companies[company].id },
    });
  }

  await prisma.jobApplication.createMany({
    data: [
      { jobId: jobs['JOB-0003'].id, workerId: workers['WK-005'].id, status: 'APPLIED', appliedAt: daysAgo(2) },
      { jobId: jobs['JOB-0004'].id, workerId: workers['WK-004'].id, status: 'HIRED', appliedAt: daysAgo(5), hiredAt: daysAgo(2) },
      { jobId: jobs['JOB-0006'].id, workerId: workers['WK-004'].id, status: 'SHORTLISTED', appliedAt: daysAgo(4) },
      { jobId: jobs['JOB-0001'].id, workerId: workers['WK-002'].id, status: 'APPLIED', appliedAt: daysAgo(1) },
      { jobId: jobs['JOB-0005'].id, workerId: workers['WK-002'].id, status: 'HIRED', appliedAt: daysAgo(9), hiredAt: daysAgo(6) },
    ],
  });

  // -------------------------------------------------------------------------
  // Transactions — the five rows on the Payments screen
  // -------------------------------------------------------------------------
  await prisma.transaction.createMany({
    data: [
      { code: 'TXN-8825', type: TransactionType.SALARY_PAYMENT, status: TransactionStatus.COMPLETED, amount: taka(25_000), fromLabel: 'Bashundhara Group', toLabel: 'Md. Rafiqul Islam', workerId: workers['WK-001'].id, occurredAt: daysAgo(0) },
      { code: 'TXN-8824', type: TransactionType.WITHDRAWAL, status: TransactionStatus.COMPLETED, amount: taka(15_000), fromLabel: 'Farida Khatun', toLabel: 'bKash Wallet', workerId: workers['WK-004'].id, occurredAt: daysAgo(0) },
      { code: 'TXN-8823', type: TransactionType.PLATFORM_FEE, status: TransactionStatus.COMPLETED, amount: taka(2_400), fromLabel: 'Square Hospitals', toLabel: 'WorkFlex BD', occurredAt: daysAgo(1) },
      { code: 'TXN-8822', type: TransactionType.REFUND, status: TransactionStatus.PENDING, amount: taka(5_000), fromLabel: 'WorkFlex BD', toLabel: 'City Bank Ltd.', refundReason: 'Duplicate salary disbursement', occurredAt: daysAgo(1) },
      { code: 'TXN-8821', type: TransactionType.SALARY_PAYMENT, status: TransactionStatus.FAILED, amount: taka(18_500), fromLabel: 'Radisson Blu Dhaka', toLabel: 'Sultana Begum', workerId: workers['WK-002'].id, failureReason: 'Beneficiary account number rejected by the receiving bank.', occurredAt: daysAgo(2) },
    ],
  });

  // -------------------------------------------------------------------------
  // Verification queue
  // -------------------------------------------------------------------------
  await prisma.verificationRequest.createMany({
    data: [
      { type: VerificationType.NID, subjectName: 'Karim Uddin', workerId: workers['WK-003'].id, submittedAt: daysAgo(1) },
      { type: VerificationType.BUSINESS, subjectName: 'City Tech Solutions', submittedAt: daysAgo(2) },
      { type: VerificationType.FACE, subjectName: 'Amina Khatun', submittedAt: daysAgo(2) },
      { type: VerificationType.COMPANY, subjectName: 'Rahman Traders Ltd.', submittedAt: daysAgo(3) },
      { type: VerificationType.WORKER, subjectName: 'Abdul Karim', submittedAt: daysAgo(3) },
      { type: VerificationType.EMPLOYER, subjectName: 'Nadia Hussain', submittedAt: daysAgo(4) },
      { type: VerificationType.NID, subjectName: 'Sultana Begum', workerId: workers['WK-002'].id, status: VerificationStatus.APPROVED, reviewedAt: daysAgo(30), submittedAt: daysAgo(32) },
    ],
  });

  // -------------------------------------------------------------------------
  // AI monitoring alerts — the four rows on the Live Alerts strip
  // -------------------------------------------------------------------------
  await prisma.alert.createMany({
    data: [
      {
        kind: AlertKind.SOS, severity: AlertSeverity.CRITICAL, status: AlertStatus.OPEN,
        message: 'SOS alert triggered at Mirpur-12 construction site',
        subjectName: 'Rekha Rani Das', workerId: workers['WK-006'].id,
        latitude: 23.804100, longitude: 90.367700, device: 'Samsung Galaxy A52',
        actionTaken: 'Authorities notified', detectedAt: minutesAgo(2),
      },
      {
        kind: AlertKind.SUSPICIOUS_LOGIN, severity: AlertSeverity.HIGH, status: AlertStatus.OPEN,
        message: 'Suspicious login from unrecognized device in Chittagong',
        subjectName: 'Jahangir Alam', workerId: workers['WK-005'].id,
        latitude: 22.356900, longitude: 91.783200, device: 'Xiaomi Redmi Note 11',
        detectedAt: minutesAgo(18),
      },
      {
        kind: AlertKind.FAKE_GPS, severity: AlertSeverity.MEDIUM, status: AlertStatus.OPEN,
        message: 'Fake GPS coordinates detected during check-in',
        subjectName: 'Karim Uddin', workerId: workers['WK-003'].id,
        latitude: 23.874300, longitude: 90.379600, device: 'Realme C35',
        detectedAt: minutesAgo(34),
      },
      {
        kind: AlertKind.FAILED_VERIFICATION, severity: AlertSeverity.LOW, status: AlertStatus.OPEN,
        message: 'Multiple failed verification attempts (6 attempts)',
        subjectName: 'Unknown User', device: 'Unknown', detectedAt: minutesAgo(60),
      },
      {
        kind: AlertKind.FRAUD, severity: AlertSeverity.HIGH, status: AlertStatus.RESOLVED,
        message: 'Payment routed to a mismatched beneficiary account',
        subjectName: 'Sultana Begum', workerId: workers['WK-002'].id,
        actionTaken: 'Transaction reversed and account re-verified',
        detectedAt: daysAgo(4), resolvedAt: daysAgo(3),
      },
    ],
  });

  // -------------------------------------------------------------------------
  // Notifications and support tickets
  // -------------------------------------------------------------------------
  await prisma.notification.createMany({
    data: [
      { kind: NotificationKind.SOS, title: 'SOS Alert — Mirpur-12', body: 'Rakka Rampura Area · Active', createdAt: minutesAgo(2) },
      { kind: NotificationKind.VERIFICATION, title: 'New Verification Request', body: 'Karim Uddin submitted an NID document', createdAt: minutesAgo(15) },
      { kind: NotificationKind.PAYMENT, title: 'Salary Payment Processed', body: 'TXN-8825 · ৳25,000', createdAt: minutesAgo(60) },
      { kind: NotificationKind.FRAUD, title: 'Fake GPS Detected', body: 'Karim Uddin during check-in', createdAt: minutesAgo(120) },
      { kind: NotificationKind.JOB, title: 'Job Application Surge', body: 'Delivery Executive · 42 applications in 1 hour', createdAt: minutesAgo(180) },
    ],
  });

  await prisma.complaint.createMany({
    data: [
      { code: 'SUP-1041', subject: 'Salary not received for July', body: 'Worker reports the July disbursement never arrived despite the job being marked complete.', reporterName: 'Sultana Begum', status: ComplaintStatus.OPEN },
      { code: 'SUP-1040', subject: 'Employer cancelled after check-in', body: 'Worker travelled to site and the shift was cancelled on arrival with no compensation.', reporterName: 'Karim Uddin', status: ComplaintStatus.IN_PROGRESS },
      { code: 'SUP-1039', subject: 'Cannot upload NID photo', body: 'Upload fails at 80% every attempt on the verification screen.', reporterName: 'Abdul Karim', status: ComplaintStatus.OPEN },
      { code: 'SUP-1038', subject: 'Duplicate charge on platform fee', body: 'Fee deducted twice for the same posting.', reporterName: 'Imran Chowdhury', status: ComplaintStatus.RESOLVED, resolution: 'Duplicate fee refunded via TXN-8822.', resolvedAt: daysAgo(1) },
    ],
  });

  // -------------------------------------------------------------------------
  // Daily metrics — seven months of rollups behind the analytics charts
  // -------------------------------------------------------------------------
  const metrics: {
    date: Date;
    revenue: bigint;
    newWorkers: number;
    activeWorkers: number;
    jobsPosted: number;
    jobsApproved: number;
  }[] = [];

  let cumulativeWorkers = 18_400;
  for (let monthOffset = 6; monthOffset >= 0; monthOffset--) {
    const growth = 1 + (6 - monthOffset) * 0.06;
    for (let day = 0; day < 28; day++) {
      const date = new Date();
      date.setMonth(date.getMonth() - monthOffset);
      date.setDate(day + 1);
      date.setHours(0, 0, 0, 0);

      const newWorkers = Math.round(28 * growth);
      cumulativeWorkers += newWorkers;

      metrics.push({
        date,
        revenue: taka(Math.round(240_000 * growth)),
        newWorkers,
        activeWorkers: cumulativeWorkers,
        jobsPosted: Math.round(11 * growth),
        jobsApproved: Math.round(8 * growth),
      });
    }
  }
  await prisma.dailyMetric.createMany({ data: metrics, skipDuplicates: true });

  // -------------------------------------------------------------------------
  // Attendance — the last 14 days for every active worker
  // -------------------------------------------------------------------------
  const activeCodes = workerSeed
    .filter((w) => w.status === WorkerStatus.ACTIVE)
    .map((w) => w.code);

  const attendanceRows: {
    workerId: string;
    date: Date;
    status: AttendanceStatus;
    checkInAt: Date | null;
    gpsFlagged: boolean;
    latitude: number | null;
    longitude: number | null;
  }[] = [];

  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - dayOffset);
    date.setUTCHours(0, 0, 0, 0);
    if (date.getUTCDay() === 5) continue; // Friday is the weekend in Bangladesh.

    activeCodes.forEach((code, index) => {
      // Deterministic spread so the summary strip is never all-green.
      const seed = (dayOffset + index) % 11;
      const status =
        seed === 0
          ? AttendanceStatus.ABSENT
          : seed === 3
            ? AttendanceStatus.LATE
            : seed === 7
              ? AttendanceStatus.ON_LEAVE
              : AttendanceStatus.PRESENT;

      const checkIn = new Date(date);
      checkIn.setUTCHours(status === AttendanceStatus.LATE ? 10 : 8, seed * 4, 0, 0);

      attendanceRows.push({
        workerId: workers[code].id,
        date,
        status,
        checkInAt: status === AttendanceStatus.ABSENT || status === AttendanceStatus.ON_LEAVE ? null : checkIn,
        gpsFlagged: seed === 5,
        latitude: status === AttendanceStatus.ABSENT ? null : 23.7806 + index * 0.01,
        longitude: status === AttendanceStatus.ABSENT ? null : 90.4074 + index * 0.01,
      });
    });
  }
  await prisma.attendanceRecord.createMany({ data: attendanceRows, skipDuplicates: true });

  // -------------------------------------------------------------------------
  // CMS blocks
  // -------------------------------------------------------------------------
  await prisma.cmsBlock.createMany({
    data: [
      { kind: CmsBlockKind.BANNER, slug: 'home-hero', title: 'Find verified work near you', titleBn: 'আপনার কাছে যাচাইকৃত কাজ খুঁজুন', position: 0, published: true },
      { kind: CmsBlockKind.BANNER, slug: 'employer-cta', title: 'Hire trusted workers in 48 hours', titleBn: '৪৮ ঘণ্টায় বিশ্বস্ত কর্মী নিয়োগ দিন', position: 1, published: true },
      { kind: CmsBlockKind.PAGE, slug: 'terms', title: 'Terms of Service', body: 'By using WorkFlex BD you agree to the platform terms governing placements, payments, and conduct.', published: true },
      { kind: CmsBlockKind.PAGE, slug: 'privacy', title: 'Privacy Policy', body: 'We collect identity documents solely to verify workers and employers, and retain them only as long as required.', published: true },
      { kind: CmsBlockKind.PAGE, slug: 'safety', title: 'Worker Safety Guide', body: 'Use the in-app SOS button if you feel unsafe on site. Alerts reach our monitoring team immediately.', published: false },
      { kind: CmsBlockKind.FAQ, slug: 'faq-payment-timing', title: 'When do I get paid?', body: 'Salary payments are released within two working days of an employer confirming a completed placement.', position: 0, published: true },
      { kind: CmsBlockKind.FAQ, slug: 'faq-verification', title: 'How long does verification take?', body: 'NID and face checks are usually reviewed within 24 hours.', position: 1, published: true },
      { kind: CmsBlockKind.FAQ, slug: 'faq-withdraw', title: 'How do I withdraw to bKash?', body: 'Open Payments, tap Withdraw, and choose your linked bKash wallet.', position: 2, published: false },
    ],
  });

  // -------------------------------------------------------------------------
  // System settings
  // -------------------------------------------------------------------------
  await prisma.systemSetting.createMany({
    data: [
      { key: 'platform.name', value: 'WorkFlex BD', valueType: SettingType.STRING, label: 'Platform name', group: 'platform' },
      { key: 'platform.default_language', value: 'en', valueType: SettingType.STRING, label: 'Default language', description: 'Shown to new users before they choose.', group: 'platform' },
      { key: 'platform.maintenance_mode', value: 'false', valueType: SettingType.BOOLEAN, label: 'Maintenance mode', description: 'Blocks the worker and employer apps while leaving admin access open.', group: 'platform' },
      { key: 'payments.platform_fee_percent', value: '8', valueType: SettingType.NUMBER, label: 'Platform fee (%)', description: 'Deducted from each completed placement.', group: 'payments' },
      { key: 'payments.min_withdrawal', value: '500', valueType: SettingType.NUMBER, label: 'Minimum withdrawal (৳)', group: 'payments' },
      { key: 'payments.auto_release_days', value: '2', valueType: SettingType.NUMBER, label: 'Auto-release after (days)', description: 'Salary is released automatically if an employer does not confirm.', group: 'payments' },
      { key: 'security.session_days', value: '30', valueType: SettingType.NUMBER, label: 'Session length (days)', group: 'security' },
      { key: 'security.require_face_verification', value: 'true', valueType: SettingType.BOOLEAN, label: 'Require face verification', description: 'Workers must pass a face check before their first placement.', group: 'security' },
      { key: 'security.gps_tolerance_metres', value: '250', valueType: SettingType.NUMBER, label: 'GPS tolerance (m)', description: 'Check-ins beyond this distance from the job site are flagged.', group: 'security' },
    ],
  });

  console.log(
    `Seeded ${workerSeed.length} workers, ${jobSeed.length} jobs, ${attendanceRows.length} attendance rows, ${metrics.length} daily metrics.`,
  );
  console.log('Sign in with admin@workflex.bd / workflex123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
