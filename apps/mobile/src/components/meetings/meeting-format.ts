/** How a meeting's time reads on a card: "Wed, 30 Sep · 3:33 AM – 4:03 AM". */
export function whenRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  return sameDay
    ? `${dateLabel(start)} · ${timeLabel(start)} – ${timeLabel(end)}`
    : `${dateLabel(start)} ${timeLabel(start)} – ${dateLabel(end)} ${timeLabel(end)}`;
}

export function dateLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function timeLabel(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

/** The next moment on the clock that is a multiple of `step` minutes. */
export function roundUp(date: Date, stepMinutes: number): Date {
  const step = stepMinutes * 60_000;
  return new Date(Math.ceil(date.getTime() / step) * step);
}

/** "2026-09-30T03:33" — what a browser date-time box wants, in local time. */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** "Ada Lovelace, Grace Hopper +2" — a few names and how many more. */
export function namesSummary(names: string[], show = 2): { shown: string; more: number } {
  return { shown: names.slice(0, show).join(', '), more: Math.max(0, names.length - show) };
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}
