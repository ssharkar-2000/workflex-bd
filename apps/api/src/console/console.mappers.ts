import type { KycStatus, UserStatus } from '@prisma/client';

/**
 * Shapes the admin console expects, mapped from this system's own tables.
 *
 * The console was built against a different backend, one that stored workers
 * and employers as separate tables with their own reference codes, ratings
 * and availability. This product has a single `User` who may both work and
 * hire, so the console's rows are assembled here rather than stored.
 *
 * Where this system has no equivalent for a field the console asks for, the
 * value is null — never a stand-in figure. A zero rating reads as "rated
 * badly"; null reads as "not rated here", which is the truth.
 */

export type ConsoleWorkerStatus = 'ACTIVE' | 'PENDING' | 'REJECTED' | 'SUSPENDED';

/**
 * A short, stable handle for a record with no code column of its own. Derived
 * from the id, so the same person is always the same code and nothing has to
 * be stored or kept unique by hand.
 */
export function referenceCode(prefix: string, id: string): string {
  return `${prefix}-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

export function displayName(
  firstName: string | null,
  lastName: string | null,
  fallback: string,
): string {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  return name || fallback;
}

export function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('');
  return letters.toUpperCase() || '—';
}

/**
 * The console's four-way worker status, from the two things this system
 * actually records: whether the account is suspended, and how far its
 * identity check got.
 */
export function workerStatus(
  status: UserStatus,
  kyc: KycStatus | null,
): ConsoleWorkerStatus {
  if (status === 'SUSPENDED' || status === 'DELETED') return 'SUSPENDED';
  if (kyc === 'APPROVED') return 'ACTIVE';
  if (kyc === 'REJECTED') return 'REJECTED';
  return 'PENDING';
}

/** Paisa, as every money column in this system is stored. */
export function toPaisa(value: bigint | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'bigint' ? Number(value) : value;
}

export function isoDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}
