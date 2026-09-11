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
export function experience(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} year${years === 1 ? '' : 's'}`);
  if (rest) parts.push(`${rest} month${rest === 1 ? '' : 's'}`);
  return parts.join(' ') || 'New';
}

/** "2m ago", "18m ago", "1h ago", "3d ago". */
export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** "SALARY_PAYMENT" -> "Salary Payment" */
export function humanise(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
