import { JOB_CATEGORY_BY_KEY, type JobCategory } from '@workflex/shared';

/**
 * The CV writer's fallback: sentences built from rules, not from a model.
 *
 * `CV_PARSER=off`, an expired key or a failed call all end up here, and this
 * is what the person sees then. It is not an apology screen — it writes a
 * real summary and real bullet points from the job title, the years and the
 * skills the person has already given, in their own language.
 *
 * What it will not do is invent. Every sentence here is either a fact the
 * person typed or a description of what that kind of work involves, which is
 * true of anyone doing it. No employer, no date, no achievement and no
 * adjective a person has not earned — the same rules the model is held to in
 * cv-writer.service.ts, because a reader cannot tell which path wrote their
 * CV and both are sent to real employers.
 */

export type CvLanguage = 'en' | 'bn';

/**
 * Ten kinds of work, which is what the phrasing actually depends on.
 *
 * The platform's twenty categories are the right vocabulary for filtering
 * jobs and the wrong one for this: a delivery rider and a truck driver need
 * the same three sentences, and writing twenty sets in two languages would
 * mean twenty chances for one of them to go stale.
 */
export type CvFamily =
  | 'HOME'
  | 'DRIVE'
  | 'FOOD'
  | 'SHOP'
  | 'OFFICE'
  | 'TEACH'
  | 'CARE'
  | 'BUILD'
  | 'GUARD'
  | 'TECH'
  | 'GENERAL';

const FAMILY_BY_CATEGORY: Record<JobCategory, CvFamily> = {
  HOUSEHOLD: 'HOME',
  DELIVERY: 'DRIVE',
  TRANSPORT: 'DRIVE',
  HOSPITALITY: 'FOOD',
  EVENTS: 'FOOD',
  RETAIL: 'SHOP',
  BEAUTY: 'SHOP',
  OFFICE: 'OFFICE',
  PROFESSIONAL: 'OFFICE',
  EDUCATION: 'TEACH',
  HEALTHCARE: 'CARE',
  EMERGENCY: 'CARE',
  VOLUNTEER: 'CARE',
  TRADES: 'BUILD',
  CONSTRUCTION: 'BUILD',
  MANUFACTURING: 'BUILD',
  AGRICULTURE: 'BUILD',
  SECURITY: 'GUARD',
  IT: 'TECH',
  CREATIVE: 'TECH',
};

/**
 * Words that place a typed job title, when no category came with it.
 *
 * Both languages in one pattern: people write "ডেলিভারি ম্যান" as often as
 * "delivery man", and a Bangla title that fell through to the general
 * wording would be the commonest case, not the rare one.
 */
const KEYWORDS: [CvFamily, RegExp][] = [
  ['DRIVE', /driv|rider|delivery|courier|parcel|logistic|transport|rickshaw|truck|bike|চালক|ড্রাইভ|ডেলিভারি|রাইড|কুরিয়ার|পরিবহন/i],
  ['FOOD', /chef|cook|kitchen|waiter|waitress|restaurant|hotel|catering|barista|baker|dishwash|রান্না|শেফ|রেস্টুরেন্ট|হোটেল|ওয়েটার|বাবুর্চি/i],
  ['HOME', /clean|maid|housekeep|nanny|babysit|domestic|laundry|garden|househol|পরিষ্কার|গৃহ|বুয়া|আয়া|কাজের|বাগান|লন্ড্রি/i],
  ['GUARD', /security|guard|watchman|bouncer|নিরাপত্তা|গার্ড|দারোয়ান|প্রহরী/i],
  ['CARE', /nurse|care|caregiver|patient|hospital|clinic|health|midwife|ward|সেবা|নার্স|স্বাস্থ্য|রোগী|হাসপাতাল|কেয়ার/i],
  ['TEACH', /teach|tutor|instructor|lectur|trainer|coach|school|madrasa|শিক্ষক|টিউশন|প্রশিক্ষ|শিক্ষা|মাদ্রাসা/i],
  ['SHOP', /sales|shop|retail|cashier|store|salon|beauty|parlour|parlor|barber|তবি?ক্রয়|দোকান|বিক্রয়|ক্যাশিয়ার|পার্লার|সেলুন/i],
  ['BUILD', /electric|plumb|carpent|weld|mason|construct|factory|mechanic|technician|labour|labor|farm|agricultur|tailor|ইলেকট্রি|প্লাম্ব|মিস্ত্রি|রাজমিস্ত্রি|নির্মাণ|কারখানা|মেকানিক|টেকনিশিয়ান|শ্রমিক|কৃষি|দর্জি/i],
  ['TECH', /develop|program|software|engineer|\bit\b|comput|design|graphic|web|data|network|ডেভেলপ|প্রোগ্রাম|সফটওয়্যার|কম্পিউটার|ডিজাইন|নেটওয়ার্ক/i],
  ['OFFICE', /office|admin|clerk|receptionis|account|data entry|secretar|assistant|manager|supervis|officer|অফিস|প্রশাসন|হিসাব|রিসেপশন|কেরানি|ম্যানেজার|সুপারভাইজার/i],
];

/** Every category's own role list, so "Pharmacy delivery" lands on DRIVE. */
const ROLE_INDEX: [CvFamily, string][] = Object.values(JOB_CATEGORY_BY_KEY).flatMap(
  (info) =>
    info.roles.map((role) => [FAMILY_BY_CATEGORY[info.key], role.toLowerCase()] as [CvFamily, string]),
);

/**
 * What kind of work a job title describes.
 *
 * The platform's own role lists are checked first — they are the titles this
 * marketplace actually posts — then the keywords, which catch everything
 * somebody types in their own words.
 */
export function cvFamilyFor(text: string, category?: JobCategory | null): CvFamily {
  if (category && FAMILY_BY_CATEGORY[category]) return FAMILY_BY_CATEGORY[category];

  const haystack = text.trim().toLowerCase();
  if (!haystack) return 'GENERAL';

  for (const [family, role] of ROLE_INDEX) {
    if (haystack.includes(role) || role.includes(haystack)) return family;
  }
  for (const [family, pattern] of KEYWORDS) {
    if (pattern.test(haystack)) return family;
  }
  return 'GENERAL';
}

type Phrases = {
  /** What the work involves, as a phrase that follows "works on …". */
  focus: string;
  /** Three duties true of that work. `{skills}` becomes the person's own. */
  bullets: [string, string, string];
};

const PHRASES: Record<CvFamily, Record<CvLanguage, Phrases>> = {
  HOME: {
    en: {
      focus: 'keeping homes clean, meals ready and families looked after',
      bullets: [
        'Cleaned and tidied homes to a set routine, including {skills}.',
        'Cooked and prepared meals for the household and kept the kitchen stocked.',
        "Worked to the family's schedule and kept their home and belongings safe.",
      ],
    },
    bn: {
      focus: 'ঘর পরিষ্কার রাখা, খাবার তৈরি করা এবং পরিবারের যত্ন নেওয়া',
      bullets: [
        'নিয়ম মেনে ঘর পরিষ্কার ও গোছানোর কাজ করেছেন — {skills} সহ।',
        'পরিবারের জন্য রান্না করেছেন এবং রান্নাঘরের জিনিসপত্র ঠিকঠাক রেখেছেন।',
        'পরিবারের সময়সূচি মেনে কাজ করেছেন এবং ঘরের জিনিসপত্র নিরাপদে রেখেছেন।',
      ],
    },
  },
  DRIVE: {
    en: {
      focus: 'getting people and parcels where they need to be, on time and safely',
      bullets: [
        'Completed daily delivery and pickup routes on time, using {skills}.',
        'Checked the vehicle before every shift and reported faults early.',
        'Handled cash on delivery and answered customer questions politely.',
      ],
    },
    bn: {
      focus: 'মানুষ ও পণ্য সময়মতো এবং নিরাপদে পৌঁছে দেওয়া',
      bullets: [
        'প্রতিদিনের ডেলিভারি ও পিকআপ সময়মতো শেষ করেছেন — {skills} কাজে লাগিয়ে।',
        'প্রতি শিফটের আগে গাড়ি পরীক্ষা করেছেন এবং সমস্যা হলে দ্রুত জানিয়েছেন।',
        'ক্যাশ অন ডেলিভারি সামলেছেন এবং গ্রাহকের প্রশ্নের ভদ্রভাবে উত্তর দিয়েছেন।',
      ],
    },
  },
  FOOD: {
    en: {
      focus: 'preparing food to order and keeping service moving through a busy shift',
      bullets: [
        'Prepared and served food to order through busy shifts, using {skills}.',
        'Kept the kitchen and service area clean and to food safety rules.',
        'Set up and cleared tables and handled customer orders and payments.',
      ],
    },
    bn: {
      focus: 'অর্ডার অনুযায়ী খাবার তৈরি করা এবং ব্যস্ত সময়েও সেবা চালু রাখা',
      bullets: [
        'ব্যস্ত শিফটে অর্ডার অনুযায়ী খাবার তৈরি ও পরিবেশন করেছেন — {skills} সহ।',
        'রান্নাঘর ও পরিবেশন এলাকা পরিষ্কার এবং খাদ্য-নিরাপত্তার নিয়ম অনুযায়ী রেখেছেন।',
        'টেবিল গুছিয়েছেন এবং গ্রাহকের অর্ডার ও পেমেন্ট সামলেছেন।',
      ],
    },
  },
  SHOP: {
    en: {
      focus: 'serving customers, handling payments and keeping stock in order',
      bullets: [
        'Served customers on the floor and answered questions about products, using {skills}.',
        'Took cash and card payments and closed the till at the end of the shift.',
        'Restocked shelves and kept the shop clean and well presented.',
      ],
    },
    bn: {
      focus: 'গ্রাহকদের সেবা দেওয়া, পেমেন্ট নেওয়া এবং মালামাল গুছিয়ে রাখা',
      bullets: [
        'দোকানে গ্রাহকদের সেবা দিয়েছেন এবং পণ্য সম্পর্কে প্রশ্নের উত্তর দিয়েছেন — {skills} সহ।',
        'নগদ ও কার্ডে পেমেন্ট নিয়েছেন এবং শিফট শেষে হিসাব মিলিয়েছেন।',
        'তাক ভরে রেখেছেন এবং দোকান পরিষ্কার ও সাজানো রেখেছেন।',
      ],
    },
  },
  OFFICE: {
    en: {
      focus: 'keeping records, appointments and the day-to-day running of an office in order',
      bullets: [
        'Kept records, files and daily reports accurate and up to date, using {skills}.',
        'Answered calls and emails and passed requests to the right person.',
        'Prepared documents and helped with monthly reporting.',
      ],
    },
    bn: {
      focus: 'নথিপত্র, সময়সূচি এবং অফিসের দৈনন্দিন কাজ গুছিয়ে রাখা',
      bullets: [
        'নথি, ফাইল ও দৈনিক রিপোর্ট সঠিক ও হালনাগাদ রেখেছেন — {skills} ব্যবহার করে।',
        'ফোন ও ইমেইলের উত্তর দিয়েছেন এবং সঠিক ব্যক্তির কাছে অনুরোধ পৌঁছে দিয়েছেন।',
        'কাগজপত্র তৈরি করেছেন এবং মাসিক রিপোর্টে সহায়তা করেছেন।',
      ],
    },
  },
  TEACH: {
    en: {
      focus: 'teaching a subject clearly and keeping track of how each student is doing',
      bullets: [
        'Taught students of different levels, covering {skills}.',
        'Set and marked homework and kept parents updated on progress.',
        'Prepared lesson plans and materials for each class.',
      ],
    },
    bn: {
      focus: 'বিষয় স্পষ্টভাবে পড়ানো এবং প্রতিটি শিক্ষার্থীর অগ্রগতি খেয়াল রাখা',
      bullets: [
        'বিভিন্ন স্তরের শিক্ষার্থীদের পড়িয়েছেন — {skills} বিষয়ে।',
        'বাড়ির কাজ দিয়েছেন ও দেখেছেন এবং অভিভাবকদের অগ্রগতি জানিয়েছেন।',
        'প্রতিটি ক্লাসের জন্য পাঠ পরিকল্পনা ও উপকরণ তৈরি করেছেন।',
      ],
    },
  },
  CARE: {
    en: {
      focus: 'looking after people who need help with daily living and health routines',
      bullets: [
        "Looked after patients' daily needs, including {skills}.",
        'Followed the care plan and reported any change to the family or the nurse.',
        'Kept records of medication, meals and appointments.',
      ],
    },
    bn: {
      focus: 'দৈনন্দিন কাজ ও স্বাস্থ্যের নিয়ম মানতে যাদের সাহায্য দরকার, তাদের দেখাশোনা করা',
      bullets: [
        'রোগীদের দৈনন্দিন প্রয়োজন দেখেছেন — {skills} সহ।',
        'সেবার পরিকল্পনা মেনে চলেছেন এবং কোনো পরিবর্তন হলে পরিবার বা নার্সকে জানিয়েছেন।',
        'ওষুধ, খাবার ও অ্যাপয়েন্টমেন্টের হিসাব রেখেছেন।',
      ],
    },
  },
  BUILD: {
    en: {
      focus: 'working to the plan and to safety rules, on site or on the line',
      bullets: [
        'Carried out site work to the plan and to safety rules, using {skills}.',
        'Measured, fitted and repaired to the standard the job required.',
        'Kept tools and materials in order and reported faults early.',
      ],
    },
    bn: {
      focus: 'পরিকল্পনা ও নিরাপত্তার নিয়ম মেনে সাইটে বা কারখানায় কাজ করা',
      bullets: [
        'পরিকল্পনা ও নিরাপত্তার নিয়ম মেনে সাইটের কাজ করেছেন — {skills} ব্যবহার করে।',
        'কাজের মান অনুযায়ী মাপজোখ, ফিটিং ও মেরামত করেছেন।',
        'যন্ত্রপাতি ও মালামাল গুছিয়ে রেখেছেন এবং ত্রুটি হলে দ্রুত জানিয়েছেন।',
      ],
    },
  },
  GUARD: {
    en: {
      focus: 'keeping a site, its people and its property safe through the shift',
      bullets: [
        'Guarded the site through the shift and kept the entry log up to date.',
        'Checked visitors and vehicles at the gate and followed the site rules.',
        'Reported anything unusual to the supervisor straight away.',
      ],
    },
    bn: {
      focus: 'শিফটজুড়ে প্রতিষ্ঠান, সেখানকার মানুষ ও সম্পদ নিরাপদ রাখা',
      bullets: [
        'শিফটজুড়ে পাহারা দিয়েছেন এবং প্রবেশের রেজিস্টার হালনাগাদ রেখেছেন।',
        'গেটে দর্শনার্থী ও গাড়ি পরীক্ষা করেছেন এবং প্রতিষ্ঠানের নিয়ম মেনে চলেছেন।',
        'অস্বাভাবিক কিছু দেখলে সঙ্গে সঙ্গে সুপারভাইজারকে জানিয়েছেন।',
      ],
    },
  },
  TECH: {
    en: {
      focus: 'building and looking after the systems a team depends on',
      bullets: [
        'Built and maintained work for the team and its clients, using {skills}.',
        'Fixed faults reported by users and kept a record of what was done.',
        'Worked with the rest of the team to finish work on schedule.',
      ],
    },
    bn: {
      focus: 'দলের প্রয়োজনীয় সিস্টেম তৈরি করা এবং দেখাশোনা করা',
      bullets: [
        'দল ও ক্লায়েন্টের জন্য কাজ তৈরি ও রক্ষণাবেক্ষণ করেছেন — {skills} দিয়ে।',
        'ব্যবহারকারীদের জানানো সমস্যা সমাধান করেছেন এবং কী করা হয়েছে তার রেকর্ড রেখেছেন।',
        'দলের সঙ্গে মিলে সময়মতো কাজ শেষ করেছেন।',
      ],
    },
  },
  GENERAL: {
    en: {
      focus: 'doing the day’s work to the standard the job asks for',
      bullets: [
        'Carried out the day’s work on time and to the standard asked for.',
        'Worked with the team and the supervisor to get the job done.',
        'Learned the tools and the routine of the job quickly.',
      ],
    },
    bn: {
      focus: 'কাজের নির্ধারিত মান অনুযায়ী প্রতিদিনের দায়িত্ব পালন করা',
      bullets: [
        'প্রতিদিনের কাজ সময়মতো ও নির্ধারিত মান অনুযায়ী শেষ করেছেন।',
        'দল ও সুপারভাইজারের সঙ্গে মিলে কাজ সম্পন্ন করেছেন।',
        'কাজের যন্ত্রপাতি ও নিয়ম দ্রুত শিখে নিয়েছেন।',
      ],
    },
  },
};

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** Bangla prose takes Bangla numerals; the rest of the app already does. */
function num(value: number, language: CvLanguage): string {
  const plain = String(value);
  return language === 'bn'
    ? plain.replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d)
    : plain;
}

function joinList(items: string[], language: CvLanguage): string {
  const clean = items.map((item) => item.trim()).filter(Boolean);
  if (clean.length <= 1) return clean[0] ?? '';
  const last = clean.pop() as string;
  return `${clean.join(', ')} ${language === 'bn' ? 'ও' : 'and'} ${last}`;
}

export type CvSummaryFacts = {
  headline: string;
  years: number;
  skills: string[];
  language: CvLanguage;
  category?: JobCategory | null;
  /** Press the button again and the same facts come back phrased differently. */
  variant?: number;
};

/**
 * A summary from the person's own title, years and skills.
 *
 * Three phrasings, cycled by `variant`, because the first draft of a sentence
 * about yourself is rarely the one you keep — and because a button that
 * returns the identical text twice reads as broken.
 */
export function cvSummaryText(facts: CvSummaryFacts): string {
  const { language, variant = 0 } = facts;
  const family = cvFamilyFor(facts.headline, facts.category);
  const { focus } = PHRASES[family][language];

  const title = facts.headline.trim();
  const years = Math.max(0, Math.min(60, Math.round(facts.years || 0)));
  const skills = joinList(facts.skills.slice(0, 4), language);

  if (language === 'bn') {
    const label = title || 'কাজে অভিজ্ঞ একজন কর্মী';
    const exp = years >= 1 ? `${num(years, 'bn')} বছরের অভিজ্ঞতা` : 'কাজের হাতেখড়ি হয়ে গেছে এবং শেখার আগ্রহ আছে';
    const skillLine = skills ? ` দক্ষতা: ${skills}।` : '';

    switch (Math.abs(variant) % 3) {
      case 1:
        return `${label}। ${exp}। কাজের মধ্যে রয়েছে ${focus}।${skillLine}`;
      case 2:
        return `${label}, ${exp}। প্রতিদিনের কাজ — ${focus}।${skillLine}`;
      default:
        return `${label}, ${exp}। ${focus} — এই কাজেই অভিজ্ঞতা।${skillLine}`;
    }
  }

  const label = title || 'Experienced worker';
  const exp =
    years >= 2
      ? `${num(years, 'en')} years of experience`
      : years === 1
        ? '1 year of experience'
        : 'a start in the work and a willingness to learn';
  const skillLine = skills ? ` Skilled in ${skills}.` : '';

  switch (Math.abs(variant) % 3) {
    case 1:
      return `${label}, with ${exp}. Day-to-day work covers ${focus}.${skillLine}`;
    case 2:
      return `${label}. ${exp.charAt(0).toUpperCase()}${exp.slice(1)}, working on ${focus}.${skillLine}`;
    default:
      return `${label} with ${exp}. Works on ${focus}.${skillLine}`;
  }
}

export type CvBulletFacts = {
  role: string;
  org?: string;
  skills: string[];
  language: CvLanguage;
  category?: JobCategory | null;
};

/** Three points for one job, from what that job involves. */
export function cvBulletLines(facts: CvBulletFacts): string[] {
  let family = cvFamilyFor(facts.role, facts.category);
  // A title like "Assistant" says nothing; the skills beside it often do.
  if (family === 'GENERAL' && facts.skills.length) {
    family = cvFamilyFor(facts.skills.join(' '));
  }

  const top = joinList(facts.skills.slice(0, 3), facts.language);
  const fallback = facts.language === 'bn' ? 'কাজের প্রয়োজনীয় দক্ষতা' : 'the tools the job needed';

  return PHRASES[family][facts.language].bullets.map((line) =>
    // A bullet that names no skill reads better without the clause than with
    // an empty one, so the placeholder falls back to a plain phrase.
    line.replace('{skills}', top || fallback),
  );
}
