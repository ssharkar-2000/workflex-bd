import type { CvProfile, Job } from '@prisma/client';

/**
 * How a CV is scored against a posting, shared by everything that has to
 * judge fit the same way: the AI shortlist, and the replacement matcher that
 * picks from the people already shortlisted. One set of rules, so a person
 * cannot be a good fit on one screen and a poor one on the next.
 */

/**
 * How the hundred points divide.
 *
 * Skills carry nearly half because they are what a recruiter screens on
 * first. The two attachment axes are small on purpose: having uploaded a
 * video is not a qualification, and weighting it heavily would sort for
 * people with a good phone and a quiet room rather than for people who can
 * do the work. They are there because a recruiter can only judge what they
 * can open, and a candidate with both is one whose shortlisting is a
 * decision rather than a guess.
 */
export const SHORTLIST_WEIGHTS = { skills: 45, experience: 20, cv: 15, intro: 10, standing: 10 } as const;

const WEIGHTS = SHORTLIST_WEIGHTS;

/** Years each experience band implies at its midpoint. */
export const LEVEL_YEARS: Record<Job['experienceLevel'], number> = {
  ENTRY: 0,
  ONE_TO_THREE: 2,
  THREE_TO_FIVE: 4,
  FIVE_PLUS: 7,
};

/**
 * The words a posting actually asks for.
 *
 * Requirements first, and only the title and description when a posting has
 * none — plenty are written in a hurry. Short and common words are dropped
 * because matching on "and" would give every CV a perfect score.
 */
export function requirementWords(job: Job): string[] {
  const source = job.requirements?.trim()
    ? `${job.requirements} ${job.title}`
    : `${job.title} ${job.description}`;

  const words = source
    .toLowerCase()
    .split(/[^a-zঀ-৿]+/)
    .filter((word) => word.length >= 4 && !STOP.has(word));

  return [...new Set(words)].slice(0, 20);
}

/** Whether a CV says a word anywhere the parser recorded. */
export function mentions(profile: CvProfile | null, word: string): boolean {
  if (!profile) return false;
  const hay = [...profile.skills, ...profile.titles, profile.summary ?? '']
    .join(' ')
    .toLowerCase();
  return hay.includes(word);
}

/** Whether the CV lists a job title that is this posting's own. */
export function heldTheJob(profile: CvProfile | null, job: Job): boolean {
  const title = job.title.toLowerCase();
  return (profile?.titles ?? []).some((held) => {
    const t = held.trim().toLowerCase();
    return t.length >= 3 && (title.includes(t) || t.includes(title));
  });
}

/**
 * The skills axis.
 *
 * Two thirds from how much of what the posting asks for the CV contains, one
 * third from having held the job before — which is the single strongest
 * signal a CV carries and the thing a recruiter screens on first. A posting
 * that lists no requirements at all cannot score anyone on them, so the
 * whole axis falls back to the title match rather than giving everybody
 * zero for the employer's omission.
 */
export function skillPoints(
  matched: number,
  wanted: number,
  profile: CvProfile | null,
  job: Job,
): number {
  const heldIt = heldTheJob(profile, job);

  if (wanted === 0) return heldIt ? WEIGHTS.skills : 0;

  const overlap = Math.min(matched / wanted, 1);
  return Math.round(WEIGHTS.skills * (overlap * 0.66 + (heldIt ? 0.34 : 0)));
}

/**
 * The experience axis.
 *
 * Full marks at or above what the posting asks for, and falling away below
 * it — never negative for having more. An unstated number scores the middle
 * rather than zero: a CV that does not add up its years is a badly written
 * CV, not an inexperienced person, and the recruiter can see the titles.
 */
export function experiencePoints(years: number | null, job: Job): number {
  const wanted = LEVEL_YEARS[job.experienceLevel];
  if (years === null) return Math.round(WEIGHTS.experience * 0.5);
  if (wanted === 0 || years >= wanted) return WEIGHTS.experience;
  return Math.round(WEIGHTS.experience * (years / wanted));
}

const STOP = new Set([
  'with', 'that', 'this', 'from', 'have', 'must', 'will', 'able', 'work',
  'working', 'good', 'need', 'needs', 'should', 'required',
  'requirement', 'requirements', 'candidate', 'applicant', 'person', 'people',
  'time', 'years', 'year', 'month', 'months', 'জন্য', 'করতে', 'হবে', 'থেকে',
  'এবং', 'সঙ্গে', 'কাজের', 'প্রয়োজন',
]);

