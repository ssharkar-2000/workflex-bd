import type { CvProfile, Job } from '@prisma/client';
import { staffingOf } from '@workflex/shared';
import { MIN_YEARS, assess, bnDigits, firstClash } from './hire-replacement.util';

const job = (over: Partial<Job> = {}): Job =>
  ({
    title: 'Electrician',
    description: 'Wiring work for a new shop.',
    requirements: 'wiring safety panels',
    experienceLevel: 'ONE_TO_THREE',
    ...over,
  }) as Job;

const cv = (over: Partial<CvProfile> = {}): CvProfile =>
  ({
    skills: ['wiring', 'safety'],
    titles: ['Electrician'],
    summary: null,
    yearsExperience: 3,
    ...over,
  }) as CvProfile;

const at = (hour: number) => new Date(Date.UTC(2026, 9, 5, hour));

describe('assess', () => {
  it('meets the posting and scores high when the CV lines up', () => {
    const result = assess(cv(), job());
    expect(result.meets).toBe(true);
    expect(result.fit).toBeGreaterThanOrEqual(80);
    expect(result.matched).toEqual(expect.arrayContaining(['wiring', 'safety']));
    expect(result.flags).toEqual([]);
  });

  it('fails on stated years below what the posting asks for', () => {
    const result = assess(cv({ yearsExperience: 2 }), job({ experienceLevel: 'FIVE_PLUS' }));
    expect(result.meets).toBe(false);
    expect(result.needsYears).toBe(MIN_YEARS.FIVE_PLUS);
    expect(result.noSkillMatch).toBe(false);
  });

  it('a "1–3 years" posting turns away nobody who has a year', () => {
    expect(assess(cv({ yearsExperience: 1 }), job()).meets).toBe(true);
    expect(assess(cv({ yearsExperience: 0 }), job()).meets).toBe(false);
  });

  it('fails when the posting lists what it wants and the CV has none of it', () => {
    const result = assess(cv({ skills: ['driving', 'cooking'], titles: ['Driver'] }), job());
    expect(result.meets).toBe(false);
    expect(result.noSkillMatch).toBe(true);
    expect(result.needsYears).toBeNull();
  });

  it('having held the job before is enough, even with no words in common', () => {
    const result = assess(
      cv({ skills: ['driving'], titles: ['Electrician'] }),
      job({ requirements: 'panels breakers switchgear' }),
    );
    expect(result.noSkillMatch).toBe(false);
    expect(result.meets).toBe(true);
  });

  it('a posting with almost no requirements cannot fail anybody on skills', () => {
    const result = assess(cv({ skills: ['driving'], titles: ['Driver'] }), job({ requirements: 'ok', title: 'Aide', description: 'help' }));
    expect(result.noSkillMatch).toBe(false);
    expect(result.meets).toBe(true);
  });

  it('what cannot be checked is flagged, not failed', () => {
    const none = assess(null, job());
    expect(none.meets).toBe(true);
    expect(none.flags).toEqual(['NO_CV']);

    const unstated = assess(cv({ yearsExperience: null }), job({ experienceLevel: 'THREE_TO_FIVE' }));
    expect(unstated.meets).toBe(true);
    expect(unstated.flags).toEqual(['YEARS_UNSTATED']);

    // An entry-level posting asks for no years, so unstated years is nothing to flag.
    expect(assess(cv({ yearsExperience: null }), job({ experienceLevel: 'ENTRY' })).flags).toEqual([]);
  });

  it('keeps the score inside 0–100', () => {
    const best = assess(cv({ yearsExperience: 30 }), job());
    const worst = assess(cv({ skills: [], titles: [], yearsExperience: 0 }), job({ experienceLevel: 'ENTRY' }));
    expect(best.fit).toBeLessThanOrEqual(100);
    expect(worst.fit).toBeGreaterThanOrEqual(0);
  });
});

describe('firstClash', () => {
  const window = [{ startsAt: at(9), endsAt: at(17) }];

  it('finds an overlapping shift', () => {
    expect(firstClash(window, [{ startsAt: at(15), endsAt: at(19) }])).toEqual(at(15));
  });

  it('does not count shifts that only touch', () => {
    expect(firstClash(window, [{ startsAt: at(17), endsAt: at(20) }, { startsAt: at(6), endsAt: at(9) }])).toBeNull();
  });

  it('returns the earliest clash', () => {
    const busy = [
      { startsAt: at(16), endsAt: at(18) },
      { startsAt: at(10), endsAt: at(11) },
    ];
    expect(firstClash(window, busy)).toEqual(at(10));
  });

  it('has nothing to clash with when there is nothing to cover', () => {
    expect(firstClash([], [{ startsAt: at(9), endsAt: at(17) }])).toBeNull();
    expect(firstClash(window, [])).toBeNull();
  });
});

describe('staffingOf', () => {
  it('needs a replacement as soon as anybody is flagged, whatever else is true', () => {
    expect(staffingOf({ vacancies: 3, working: 3, unavailable: 1 })).toBe('NEEDS_REPLACEMENT');
    expect(staffingOf({ vacancies: null, working: 0, unavailable: 1 })).toBe('NEEDS_REPLACEMENT');
  });

  it('is recruiting until somebody is hired', () => {
    expect(staffingOf({ vacancies: 2, working: 0, unavailable: 0 })).toBe('RECRUITING');
  });

  it('is partly filled below the vacancies and filled at them', () => {
    expect(staffingOf({ vacancies: 3, working: 2, unavailable: 0 })).toBe('PARTLY_FILLED');
    expect(staffingOf({ vacancies: 3, working: 3, unavailable: 0 })).toBe('FILLED');
    expect(staffingOf({ vacancies: 3, working: 4, unavailable: 0 })).toBe('FILLED');
  });

  it('treats an unstated number of vacancies as the people hired', () => {
    expect(staffingOf({ vacancies: null, working: 2, unavailable: 0 })).toBe('FILLED');
  });
});

describe('bnDigits', () => {
  it('writes numbers in Bangla numerals', () => {
    expect(bnDigits(0)).toBe('০');
    expect(bnDigits(2026)).toBe('২০২৬');
  });
});
