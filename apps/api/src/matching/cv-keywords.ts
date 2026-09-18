import { JOB_CATEGORIES, type JobCategory } from '@workflex/shared';

/**
 * Reads a CV without a model call.
 *
 * The pipeline extracts text locally and then asks a language model to
 * structure it. When that call cannot be made — no API key, no credit, the
 * provider unreachable — everything downstream died with it: no profile, no
 * match scores, no recommendations, from a CV that had uploaded perfectly
 * well. A feature that only works while an external account is funded is not
 * one this product can depend on.
 *
 * This is the floor beneath that.
 *
 * The first attempt matched the taxonomy's own 159 role names against the CV
 * text and found nothing at all in a real one, because that is not how people
 * write. A CV says "Python, React Native, MySQL" and "software engineering";
 * the taxonomy says "Software developer". Matching titles against titles only
 * works when both sides happen to use the same phrase.
 *
 * So the vocabulary below is the one CVs actually use — tools, languages,
 * duties and materials — each mapped to the category it implies. It stays
 * deliberately small: high-signal terms that rarely appear by accident, rather
 * than an ontology nobody will maintain.
 */

/**
 * Terms that imply a category, lowercased.
 *
 * Chosen for precision over recall, and pruned against a real CV rather than
 * imagination. Two entries had to go after that test:
 *
 * - "curriculum" matched *Curriculum Vitae*, the title on the document itself,
 *   and so tagged every CV ever uploaded as education work.
 * - "driver" matched "motor drivers" in an electronics project, and put truck
 *   driving in front of a computer science student.
 *
 * The lesson is that a term earns its place only if it is unambiguous in the
 * kind of document being read. "Manager" and "assistant" are absent for the
 * same reason — they mean twenty different things each.
 */
export const SIGNALS: { category: JobCategory; terms: readonly string[] }[] = [
  {
    category: 'IT',
    terms: [
      'python', 'java', 'javascript', 'typescript', 'c++', 'php', 'kotlin',
      'swift', 'react', 'react native', 'node.js', 'nodejs', 'express',
      'spring boot', 'django', 'laravel', 'flutter', 'html', 'css',
      'mysql', 'postgresql', 'mongodb', 'sql', 'database design',
      'rest api', 'api integration', 'git', 'github', 'firebase', 'docker',
      'machine learning', 'tensorflow', 'keras', 'scikit-learn', 'pytorch',
      'opencv', 'computer vision', 'data science', 'software engineering',
      'web development', 'app development', 'backend', 'frontend',
      'full stack', 'programmer', 'software developer', 'web developer',
    ],
  },
  {
    category: 'CREATIVE',
    terms: [
      'figma', 'photoshop', 'illustrator', 'adobe xd', 'ui/ux', 'ux design',
      'graphic design', 'video editing', 'premiere pro', 'after effects',
      'photography', 'animation', 'content writing', 'copywriting',
    ],
  },
  {
    category: 'OFFICE',
    terms: [
      'microsoft office', 'ms word', 'ms excel', 'excel', 'powerpoint',
      'data entry', 'bookkeeping', 'accounting', 'quickbooks', 'tally',
      'administrative', 'receptionist', 'office assistant',
    ],
  },
  {
    category: 'EDUCATION',
    terms: [
      'teaching', 'tutor', 'tuition', 'lecturer', 'lesson plan',
      'classroom', 'coaching centre', 'coaching center', 'teaching assistant',
    ],
  },
  {
    category: 'HEALTHCARE',
    terms: [
      'nursing', 'nurse', 'patient care', 'clinic', 'hospital', 'pharmacy',
      'pharmacist', 'first aid', 'caregiver', 'physiotherapy', 'mbbs',
      'medical assistant', 'lab technician',
    ],
  },
  {
    category: 'DELIVERY',
    terms: [
      'delivery', 'courier', 'rider', 'parcel', 'dispatch', 'last mile',
      'food delivery',
    ],
  },
  {
    category: 'TRANSPORT',
    terms: [
      'driving licence', 'driving license', 'chauffeur',
      'cng driver', 'truck driver', 'bus driver', 'logistics', 'fleet',
    ],
  },
  {
    category: 'CONSTRUCTION',
    terms: [
      'masonry', 'mason', 'carpenter', 'carpentry', 'welding', 'welder',
      'rod binding', 'tiles fitting', 'painter', 'construction site',
      'civil engineering', 'autocad', 'site supervisor',
    ],
  },
  {
    category: 'TRADES',
    terms: [
      'electrician', 'electrical wiring', 'plumber', 'plumbing',
      'ac technician', 'air conditioner repair', 'refrigeration',
      'mechanic', 'machine operator', 'technician',
    ],
  },
  {
    category: 'HOSPITALITY',
    terms: [
      'waiter', 'waitress', 'chef', 'cook', 'kitchen', 'barista',
      'restaurant', 'catering', 'housekeeping', 'hotel',
    ],
  },
  {
    category: 'RETAIL',
    terms: [
      'cashier', 'sales assistant', 'shop assistant', 'salesman',
      'merchandising', 'inventory', 'stock keeping', 'point of sale',
      'customer service', 'retail',
    ],
  },
  {
    category: 'SECURITY',
    terms: ['security guard', 'guard duty', 'cctv', 'surveillance', 'patrol'],
  },
  {
    category: 'BEAUTY',
    terms: [
      'hairdressing', 'hair stylist', 'beautician', 'makeup artist',
      'parlour', 'parlor', 'salon', 'manicure', 'facial',
    ],
  },
  {
    category: 'HOUSEHOLD',
    terms: [
      'house cleaning', 'housemaid', 'domestic help', 'babysitting',
      'elderly care', 'laundry', 'ironing', 'gardening',
    ],
  },
  {
    category: 'MANUFACTURING',
    terms: [
      'garments', 'sewing', 'tailoring', 'production line', 'assembly line',
      'quality control', 'factory', 'packaging', 'machine operation',
    ],
  },
  {
    category: 'AGRICULTURE',
    terms: ['farming', 'agriculture', 'poultry', 'livestock', 'fishery', 'harvest'],
  },
  {
    category: 'EVENTS',
    terms: ['event management', 'wedding planning', 'decoration', 'usher', 'stage setup'],
  },
  {
    category: 'PROFESSIONAL',
    terms: [
      'marketing', 'digital marketing', 'seo', 'human resources',
      'recruitment', 'business development', 'project management',
      'market research', 'translation', 'legal',
    ],
  },
];

/**
 * Role names from the taxonomy, kept as an extra pass.
 *
 * Rarely the thing that fires — CVs seldom use these exact phrases — but when
 * one does appear it is the most precise signal available, so it costs nothing
 * to look.
 */
const ROLE_TERMS: { category: JobCategory; terms: string[] }[] =
  JOB_CATEGORIES.map((category) => ({
    category: category.key,
    terms: category.roles.map((role) => role.toLowerCase()),
  }));

/**
 * Years of experience, from the phrasings a CV actually uses.
 *
 * Takes the largest number found rather than the first: a CV names durations
 * for individual jobs as well as for a career, and the total is the useful
 * one. Capped at 50, so a stray "2019 years" cannot poison the score.
 */
function yearsFrom(text: string): number | null {
  const matches = [...text.matchAll(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b/gi)];
  const years = matches
    .map((m) => Number.parseInt(m[1] ?? '', 10))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 50);
  return years.length > 0 ? Math.max(...years) : null;
}

/**
 * Whether a term appears as a whole word, rather than inside a longer one.
 *
 * A plain substring test is wrong here in a way that is easy to miss and hard
 * to spot in the output. Tested against a real CV it read "git" out of
 * *di**git**al*, "java" out of *java**script*, and would read "excel" out of
 * *excel**lent* — each one silently adding a skill the person never claimed.
 *
 * `\b` cannot do this alone: several terms end in punctuation (`c++`,
 * `node.js`, `ui/ux`), where there is no word boundary to anchor to. Guarding
 * on the neighbouring character instead works for both shapes.
 */
export function mentions(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i').test(haystack);
}

export interface LocalCvExtract {
  skills: string[];
  titles: string[];
  categories: JobCategory[];
  yearsExperience: number | null;
  summary: string | null;
}

/**
 * Returns null when nothing recognisable was found.
 *
 * An empty profile is worse than no profile: the matcher would score every
 * posting against zero skills and tell the person they are a poor fit for all
 * of them, which is a claim built on no evidence.
 */
export function extractFromKeywords(text: string): LocalCvExtract | null {
  const haystack = text.toLowerCase();

  const skills: string[] = [];
  const categories = new Set<JobCategory>();

  for (const group of SIGNALS) {
    for (const term of group.terms) {
      if (mentions(haystack, term)) {
        skills.push(term);
        categories.add(group.category);
      }
    }
  }

  const titles: string[] = [];
  for (const group of ROLE_TERMS) {
    for (const term of group.terms) {
      if (mentions(haystack, term)) {
        titles.push(term);
        categories.add(group.category);
      }
    }
  }

  if (skills.length === 0 && titles.length === 0) return null;

  return {
    // The matcher intersects these with the posting's text, so the matched
    // terms themselves are exactly what it needs — "react native" finds a
    // React Native posting without any translation step.
    skills: [...new Set(skills)],
    titles: [...new Set(titles)],
    categories: [...categories],
    yearsExperience: yearsFrom(text),
    // Left null rather than invented. The summary is shown back as "here is
    // what we understood", and a sentence stitched from keywords would claim
    // comprehension this did not perform.
    summary: null,
  };
}
