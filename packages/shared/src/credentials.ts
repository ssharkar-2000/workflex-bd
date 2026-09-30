import { z } from 'zod';

/**
 * Verifiable credentials: degrees, certificates and experience letters that
 * a recruiter can check without telephoning anybody.
 *
 * The thing that makes a credential verifiable is not where it is stored, it
 * is the signature. The issuing university or employer signs the exact
 * contents with a private key that WorkFlex BD has never held and cannot
 * obtain; anyone with the matching public key can confirm, offline and
 * forever, that those contents were signed by that key and have not been
 * altered by a character since. No phone call, no email, no "please confirm
 * this person worked here", no forged letterhead.
 *
 * On top of the signature sits the ledger. Every credential records the hash
 * of the one issued before it, which makes the record append-only: editing
 * an old entry changes its hash and orphans every entry after it, so
 * tampering is not merely detectable, it is loud. That structure is what a
 * blockchain is, and this implementation is honest about the difference
 * between having the structure and having a public chain — see the note on
 * `anchored` below, and credentials.service.ts in the API.
 */

export const issuerKindSchema = z.enum([
  'UNIVERSITY',
  'COLLEGE',
  'TRAINING_CENTRE',
  'EMPLOYER',
  'GOVERNMENT',
]);
export type IssuerKind = z.infer<typeof issuerKindSchema>;

export const credentialKindSchema = z.enum([
  'DEGREE',
  'DIPLOMA',
  'CERTIFICATE',
  'TRAINING',
  'EXPERIENCE_LETTER',
  'LICENCE',
]);
export type CredentialKind = z.infer<typeof credentialKindSchema>;

export const credentialIssuerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: issuerKindSchema,
  /** `did:key:z...`, derived from the public key. Portable proof of identity. */
  did: z.string(),
  website: z.string().nullable(),
  /**
   * Whether this platform has confirmed the key belongs to the named body.
   *
   * A signature proves a key signed something. Only a registry can say whose
   * key it is, and that step is a human one — so it is reported separately
   * rather than folded into a single green tick.
   */
  approved: z.boolean(),
});
export type CredentialIssuer = z.infer<typeof credentialIssuerSchema>;

/** One of the five things checked, and what it found. */
export const credentialCheckSchema = z.object({
  key: z.enum(['hash', 'signature', 'issuer', 'chain', 'revocation']),
  ok: z.boolean(),
  /** Plain words, not a status code. The reader has to understand this. */
  detail: z.string(),
});
export type CredentialCheck = z.infer<typeof credentialCheckSchema>;

export const credentialSchema = z.object({
  id: z.string().uuid(),
  kind: credentialKindSchema,
  title: z.string(),
  field: z.string().nullable(),
  grade: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  issuedAt: z.string(),

  issuer: credentialIssuerSchema,

  /** Position in the ledger, from zero. */
  index: z.number().int().nonnegative(),
  /** SHA-256 of the signed payload, hex. Shown so it can be compared. */
  hash: z.string(),

  revoked: z.boolean(),
  revokeReason: z.string().nullable(),

  /** True only when every check passed. */
  valid: z.boolean(),
  checks: z.array(credentialCheckSchema),
});
export type Credential = z.infer<typeof credentialSchema>;

export const credentialListSchema = z.object({
  credentials: z.array(credentialSchema),
  /** How many are fully valid right now. */
  validCount: z.number().int().nonnegative(),
  /**
   * Whether the ledger has been written to a public chain.
   *
   * False, and said so rather than implied otherwise. The signatures and the
   * hash chain are real and do the work; what a public anchor would add is
   * that nobody — including whoever runs this server — could rewrite the
   * whole chain at once. Until that exists, this says false.
   */
  anchored: z.boolean(),
  /** Length of the whole ledger, across every account. */
  ledgerLength: z.number().int().nonnegative(),
});
export type CredentialList = z.infer<typeof credentialListSchema>;

/** What a person fills in when asking an institution to attest to something. */
export const credentialRequestSchema = z.object({
  issuerId: z.string().uuid(),
  kind: credentialKindSchema,
  title: z.string().trim().min(2).max(160),
  field: z.string().trim().max(160).optional(),
  grade: z.string().trim().max(60).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
export type CredentialRequestDto = z.infer<typeof credentialRequestSchema>;

export const issuerListSchema = z.object({
  issuers: z.array(credentialIssuerSchema),
});
export type IssuerList = z.infer<typeof issuerListSchema>;

/** The whole-ledger check, for the screen that offers it. */
export const ledgerReportSchema = z.object({
  length: z.number().int().nonnegative(),
  intact: z.boolean(),
  /** Index of the first entry that does not check out, or null. */
  brokenAt: z.number().int().nullable(),
  detail: z.string(),
});
export type LedgerReport = z.infer<typeof ledgerReportSchema>;
