/**
 * These helpers used to return plain hardcoded English strings ("4 years 3
 * months", "New", "just now", "2h ago") no matter which language the app was
 * set to, because they were called directly instead of through `t()` — that
 * was one of the main reasons the Bangla UI still had English words all over
 * it. `experience` and `timeAgo` now take the `t` function from `useI18n()`
 * so their output is translated like everything else. Every call site below
 * was updated to pass `t` through.
 */
type TFn = (key: string, vars?: Record<string, string | number>) => string;

/**
 * The design shows money three ways: full (৳25,000), lakh (৳83.1L), and crore
 * (৳4.83Cr). Everything arrives from the API as paisa, so conversion happens
 * once here.
 */
export function taka(paisa: number, compact = false): string {
  const amount = paisa / 100;

  if (compact) {
    if (amount >= 1e7) return `৳${(amount / 1e7).toFixed(2)}Cr`;
    if (amount >= 1e5) return `৳${(amount / 1e5).toFixed(1)}L`;
    if (amount >= 1e3) return `৳${(amount / 1e3).toFixed(1)}k`;
  }

  return `৳${Math.round(amount).toLocaleString('en-IN')}`;
}

export function salaryRange(min: number, max: number): string {
  return `${taka(min)}–${taka(max)}`;
}

/** "51" -> "4 years 3 months", matching the worker cards. */
export function experience(months: number, t: TFn): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years) parts.push(t(years === 1 ? 'duration.year' : 'duration.years', { count: years }));
  if (rest) parts.push(t(rest === 1 ? 'duration.month' : 'duration.months', { count: rest }));
  return parts.join(' ') || t('duration.new');
}

/** "2m ago", "18m ago", "1h ago", "3d ago". */
export function timeAgo(iso: string, t: TFn): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return t('duration.justNow');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('duration.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('duration.hoursAgo', { count: hours });
  return t('duration.daysAgo', { count: Math.floor(hours / 24) });
}

/**
 * `humanise()` used to live here as a generic SNAKE_CASE -> "Title Case"
 * formatter, called directly wherever a backend enum needed a friendly label
 * (transaction type, alert kind, verification type). It always produced
 * English no matter the app's language. Every call site now looks its value
 * up in a small `Record<Enum, translationKey>` map defined in that screen and
 * renders `t(key)` instead — see PaymentsScreen, TransactionDetailScreen,
 * AlertDetailScreen, and VerificationScreen.
 */

/**
 * Plain DD/MM/YYYY instead of `toLocaleDateString('en-GB', { month: 'short' })`
 * — the old version always printed the month as "Jan"/"Sep"/etc. in English
 * even with the app set to Bangla (Hermes' limited ICU data also can't
 * reliably localise this to 'bn-BD' anyway), so dates were another spot where
 * English text leaked into the Bangla UI. A numeric format has no words to
 * translate in the first place.
 */
export function longDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}
