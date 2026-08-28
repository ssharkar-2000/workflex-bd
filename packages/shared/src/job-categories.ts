import { z } from 'zod';

/**
 * The work this marketplace covers.
 *
 * Fixed reference data rather than a database table: the list changes when
 * the product changes, not when a user does something, and every layer needs
 * the same twenty values — the seeker's filter chips, the recruiter's posting
 * form, and the admin console's reports. A table would put that vocabulary
 * behind a query and let the three drift apart.
 *
 * `roles` are the job titles typical of each category. They are not an
 * enumeration a posting must choose from — a recruiter writes their own title
 * — but they seed the sample data and will back title suggestions when the
 * posting form is built.
 */

export const jobCategorySchema = z.enum([
  'HOUSEHOLD',
  'DELIVERY',
  'HOSPITALITY',
  'RETAIL',
  'OFFICE',
  'IT',
  'EDUCATION',
  'TRADES',
  'BEAUTY',
  'HEALTHCARE',
  'CONSTRUCTION',
  'AGRICULTURE',
  'EVENTS',
  'TRANSPORT',
  'MANUFACTURING',
  'SECURITY',
  'PROFESSIONAL',
  'CREATIVE',
  'VOLUNTEER',
  'EMERGENCY',
]);
export type JobCategory = z.infer<typeof jobCategorySchema>;

export interface JobCategoryInfo {
  key: JobCategory;
  emoji: string;
  /** English name. */
  en: string;
  /** Bangla name — the majority language of this market. */
  bn: string;
  roles: readonly string[];
}

export const JOB_CATEGORIES: readonly JobCategoryInfo[] = [
  {
    key: 'HOUSEHOLD',
    emoji: '🏠',
    en: 'Household Services',
    bn: 'গৃহস্থালি সেবা',
    roles: [
      'House cleaning',
      'Cooking',
      'Laundry & ironing',
      'Babysitting',
      'Elderly care',
      'Pet care',
      'Gardening',
      'Home organizing',
      'Grocery shopping',
      'Car washing',
      'Home moving assistance',
    ],
  },
  {
    key: 'DELIVERY',
    emoji: '📦',
    en: 'Delivery & Logistics',
    bn: 'ডেলিভারি ও লজিস্টিকস',
    roles: [
      'Food delivery',
      'Parcel delivery',
      'Grocery delivery',
      'Pharmacy delivery',
      'Document delivery',
      'Courier services',
      'Warehouse helper',
      'Packing assistant',
      'Loading & unloading',
      'Inventory assistant',
    ],
  },
  {
    key: 'HOSPITALITY',
    emoji: '🍽️',
    en: 'Hospitality & Restaurant',
    bn: 'হোটেল ও রেস্টুরেন্ট',
    roles: [
      'Waiter/Waitress',
      'Barista',
      'Kitchen helper',
      'Dishwasher',
      'Cashier',
      'Restaurant cleaner',
      'Receptionist',
      'Hotel housekeeping',
      'Room service',
      'Event catering staff',
    ],
  },
  {
    key: 'RETAIL',
    emoji: '🛒',
    en: 'Retail & Sales',
    bn: 'খুচরা বিক্রয়',
    roles: [
      'Shop assistant',
      'Sales representative',
      'Cashier',
      'Customer service',
      'Promoter',
      'Merchandiser',
      'Stock manager',
      'Sales executive',
      'Shopping mall assistant',
    ],
  },
  {
    key: 'OFFICE',
    emoji: '💼',
    en: 'Office & Administrative',
    bn: 'অফিস ও প্রশাসনিক',
    roles: [
      'Data entry',
      'Office assistant',
      'Receptionist',
      'Administrative assistant',
      'Personal assistant',
      'Call center agent',
      'HR assistant',
      'Accountant',
      'Document processing',
    ],
  },
  {
    key: 'IT',
    emoji: '💻',
    en: 'IT & Digital Services',
    bn: 'আইটি ও ডিজিটাল সেবা',
    roles: [
      'Software developer',
      'Web developer',
      'Mobile app developer',
      'UI/UX designer',
      'Graphic designer',
      'Digital marketer',
      'SEO specialist',
      'Video editor',
      'Content writer',
      'AI engineer',
      'Cybersecurity specialist',
    ],
  },
  {
    key: 'EDUCATION',
    emoji: '📚',
    en: 'Education & Training',
    bn: 'শিক্ষা ও প্রশিক্ষণ',
    roles: [
      'Home tutor',
      'Online tutor',
      'Language teacher',
      'Music instructor',
      'Sports coach',
      'Computer trainer',
      'Private teacher',
      'Exam preparation tutor',
    ],
  },
  {
    key: 'TRADES',
    emoji: '🔧',
    en: 'Skilled Trades',
    bn: 'কারিগরি কাজ',
    roles: [
      'Electrician',
      'Plumber',
      'Carpenter',
      'Painter',
      'Mason',
      'Welder',
      'AC technician',
      'Refrigerator technician',
      'CCTV installer',
      'Mechanic',
    ],
  },
  {
    key: 'BEAUTY',
    emoji: '💄',
    en: 'Beauty & Personal Care',
    bn: 'রূপচর্চা ও পরিচর্যা',
    roles: [
      'Hair stylist',
      'Barber',
      'Makeup artist',
      'Beautician',
      'Massage therapist',
      'Nail technician',
      'Spa therapist',
    ],
  },
  {
    key: 'HEALTHCARE',
    emoji: '🏥',
    en: 'Healthcare',
    bn: 'স্বাস্থ্যসেবা',
    roles: [
      'Nurse',
      'Caregiver',
      'Home nursing',
      'Physiotherapist',
      'Medical assistant',
      'Lab technician',
      'Ambulance assistant',
      'Pharmacy assistant',
    ],
  },
  {
    key: 'CONSTRUCTION',
    emoji: '🚧',
    en: 'Construction',
    bn: 'নির্মাণ',
    roles: [
      'Construction worker',
      'Site supervisor',
      'Civil engineer',
      'Architect',
      'Heavy equipment operator',
      'Helper',
      'Safety officer',
    ],
  },
  {
    key: 'AGRICULTURE',
    emoji: '🌾',
    en: 'Agriculture',
    bn: 'কৃষি',
    roles: [
      'Farm worker',
      'Harvest worker',
      'Livestock caretaker',
      'Irrigation worker',
      'Greenhouse worker',
      'Fisheries assistant',
    ],
  },
  {
    key: 'EVENTS',
    emoji: '🎉',
    en: 'Event & Entertainment',
    bn: 'ইভেন্ট ও বিনোদন',
    roles: [
      'Event staff',
      'Photographer',
      'Videographer',
      'DJ',
      'Sound technician',
      'Stage assistant',
      'Security staff',
      'Decorator',
      'Master of Ceremony (MC)',
    ],
  },
  {
    key: 'TRANSPORT',
    emoji: '🚗',
    en: 'Transportation',
    bn: 'পরিবহন',
    roles: [
      'Car driver',
      'Bike rider',
      'Truck driver',
      'Bus driver',
      'Chauffeur',
      'Ride-sharing driver',
    ],
  },
  {
    key: 'MANUFACTURING',
    emoji: '🏭',
    en: 'Manufacturing & Factory',
    bn: 'উৎপাদন ও কারখানা',
    roles: [
      'Machine operator',
      'Factory worker',
      'Production assistant',
      'Quality inspector',
      'Packaging worker',
      'Assembly line worker',
    ],
  },
  {
    key: 'SECURITY',
    emoji: '🛡️',
    en: 'Security Services',
    bn: 'নিরাপত্তা সেবা',
    roles: [
      'Security guard',
      'CCTV operator',
      'Night guard',
      'Event security',
      'Building security',
    ],
  },
  {
    key: 'PROFESSIONAL',
    emoji: '👔',
    en: 'Professional Services',
    bn: 'পেশাদার সেবা',
    roles: [
      'Lawyer',
      'Consultant',
      'Accountant',
      'Tax consultant',
      'Financial advisor',
      'Business consultant',
      'Auditor',
    ],
  },
  {
    key: 'CREATIVE',
    emoji: '🎨',
    en: 'Creative & Media',
    bn: 'সৃজনশীল ও মিডিয়া',
    roles: [
      'Photographer',
      'Illustrator',
      'Animator',
      'Voice-over artist',
      'Social media manager',
      'Copywriter',
      'Content creator',
    ],
  },
  {
    key: 'VOLUNTEER',
    emoji: '❤️',
    en: 'Volunteer & Community Work',
    bn: 'স্বেচ্ছাসেবা ও সমাজকর্ম',
    roles: [
      'NGO volunteer',
      'Blood donation volunteer',
      'Disaster response volunteer',
      'Community service',
      'Charity event volunteer',
    ],
  },
  {
    key: 'EMERGENCY',
    emoji: '🚨',
    en: 'Emergency & On-Demand',
    bn: 'জরুরি ও তাৎক্ষণিক কাজ',
    roles: [
      'Emergency cleaner',
      'Last-minute waiter',
      'Temporary cashier',
      'Event helper',
      'Moving assistant',
      'Emergency driver',
      'Relief worker',
      'Hospital support staff',
    ],
  },
] as const;

/** Keyed lookup, for turning a stored category back into its label. */
export const JOB_CATEGORY_BY_KEY: Record<JobCategory, JobCategoryInfo> =
  Object.fromEntries(JOB_CATEGORIES.map((c) => [c.key, c])) as Record<
    JobCategory,
    JobCategoryInfo
  >;

export function jobCategoryName(
  key: JobCategory,
  locale: 'en' | 'bn',
): string {
  const info = JOB_CATEGORY_BY_KEY[key];
  return locale === 'bn' ? info.bn : info.en;
}
