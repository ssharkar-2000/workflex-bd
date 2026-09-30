import { addMonthsUtc, expandOccurrences, isInCall, joinWindow } from './meeting-schedule.util';

const at = (iso: string) => new Date(iso);

describe('expandOccurrences', () => {
  const first = { startsAt: at('2026-10-05T04:00:00Z'), endsAt: at('2026-10-05T04:30:00Z') };

  it('makes one meeting when it does not repeat, whatever the count says', () => {
    expect(expandOccurrences(first, 'NONE', 6)).toHaveLength(1);
  });

  it('repeats daily and weekly, keeping the length', () => {
    const daily = expandOccurrences(first, 'DAILY', 3);
    expect(daily.map((s) => s.startsAt.toISOString())).toEqual([
      '2026-10-05T04:00:00.000Z',
      '2026-10-06T04:00:00.000Z',
      '2026-10-07T04:00:00.000Z',
    ]);
    expect(daily[2]!.endsAt.toISOString()).toBe('2026-10-07T04:30:00.000Z');

    const weekly = expandOccurrences(first, 'WEEKLY', 2);
    expect(weekly[1]!.startsAt.toISOString()).toBe('2026-10-12T04:00:00.000Z');
  });

  it('keeps a monthly meeting on the 31st from drifting to the 28th', () => {
    const jan31 = { startsAt: at('2027-01-31T04:00:00Z'), endsAt: at('2027-01-31T05:00:00Z') };
    const days = expandOccurrences(jan31, 'MONTHLY', 4).map((s) => s.startsAt.toISOString().slice(0, 10));
    expect(days).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  });
});

describe('addMonthsUtc', () => {
  it('handles leap years and year ends', () => {
    expect(addMonthsUtc(at('2028-01-31T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2028-02-29');
    expect(addMonthsUtc(at('2026-12-15T00:00:00Z'), 2).toISOString().slice(0, 10)).toBe('2027-02-15');
  });
});

describe('joinWindow', () => {
  const slot = { startsAt: at('2026-10-05T04:00:00Z'), endsAt: at('2026-10-05T05:00:00Z') };

  it('lets the host in an hour early and a guest 15 minutes early', () => {
    expect(joinWindow(slot, 'HOST').opensAt.toISOString()).toBe('2026-10-05T03:00:00.000Z');
    expect(joinWindow(slot, 'GUEST').opensAt.toISOString()).toBe('2026-10-05T03:45:00.000Z');
  });

  it('keeps the door open for two hours after the end', () => {
    expect(joinWindow(slot, 'GUEST').closesAt.toISOString()).toBe('2026-10-05T07:00:00.000Z');
  });
});

describe('isInCall', () => {
  const now = at('2026-10-05T04:10:00Z');

  it('is true after joining and false after leaving', () => {
    expect(isInCall({ joinedAt: at('2026-10-05T04:00:00Z'), leftAt: null }, now)).toBe(true);
    expect(isInCall({ joinedAt: at('2026-10-05T04:00:00Z'), leftAt: at('2026-10-05T04:05:00Z') }, now)).toBe(false);
  });

  it('is true again when they rejoin after leaving', () => {
    expect(isInCall({ joinedAt: at('2026-10-05T04:08:00Z'), leftAt: at('2026-10-05T04:05:00Z') }, now)).toBe(true);
  });

  it('does not keep somebody in the call forever if they never left', () => {
    expect(isInCall({ joinedAt: at('2026-10-05T04:00:00Z'), leftAt: null }, at('2026-10-05T11:00:00Z'))).toBe(false);
    expect(isInCall({ joinedAt: null, leftAt: null }, now)).toBe(false);
  });
});
