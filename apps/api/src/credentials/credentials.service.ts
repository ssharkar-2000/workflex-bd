import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import type { Credential as Row, Issuer, Prisma } from '@prisma/client';
import {
  ApiErrorCode,
  type Credential,
  type CredentialCheck,
  type CredentialIssuer,
  type CredentialList,
  type IssuerList,
  type LedgerReport,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';

/** The `prevHash` of the first entry in the ledger. */
export const GENESIS = '0'.repeat(64);

/**
 * TrustChain: credentials a recruiter can check without telephoning anybody.
 *
 * ## What actually makes this work
 *
 * Not storage. A signature. The issuing university or employer holds an
 * ed25519 private key that this server has never seen and cannot obtain, and
 * signs the exact contents of a credential with it. Anyone holding the
 * credential and the matching public key can confirm — offline, forever,
 * without asking us anything — that those contents were signed by that key
 * and have not been altered by one character since.
 *
 * That is the whole of the "no more phone calls to HR" claim, and it is real.
 *
 * ## What the chain adds
 *
 * Every credential stores the SHA-256 of the one issued before it. Editing
 * an old row changes its hash, which orphans every row after it, so tampering
 * is not merely detectable but loud and unmissable. That structure — an
 * append-only hash chain — is what a blockchain is made of.
 *
 * ## What is deliberately not claimed
 *
 * This ledger lives in this database. A public chain would add exactly one
 * property that this cannot have: that nobody, including whoever runs this
 * server, could quietly rewrite the *entire* chain in one go and present a
 * consistent forgery. That property is worth having and it is not here yet,
 * so `anchored` reports false and the screen says so in plain words rather
 * than letting a reader assume otherwise.
 *
 * Getting there is one adapter: publish the head hash to a public chain on a
 * schedule and store the transaction id. Every credential issued before that
 * anchor is then provably older than it. Nothing else in this file changes,
 * which is why the head hash is computed and exposed rather than kept
 * implicit.
 */
@Injectable()
export class CredentialsService {
  private readonly logger = new Logger(CredentialsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Institutions this platform knows about, for the request form. */
  async issuers(): Promise<IssuerList> {
    const rows = await this.prisma.issuer.findMany({
      orderBy: [{ approvedAt: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
      take: 200,
    });
    return { issuers: rows.map(toIssuer) };
  }

  /** This person's own credentials, each independently re-checked. */
  async mine(userId: string): Promise<CredentialList> {
    return this.listFor(userId);
  }

  /**
   * An applicant's credentials, for the person who posted the job.
   *
   * Only the poster, and only for somebody who actually applied — a
   * verifiable credential is still somebody's education and employment
   * history, and it is not public because it is checkable.
   */
  async forApplicant(
    ownerId: string,
    jobId: string,
    applicantId: string,
  ): Promise<CredentialList> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { postedBy: true },
    });
    if (!job || job.postedBy !== ownerId) {
      throw AppException.notFound('That job is not yours to manage');
    }

    const applied = await this.prisma.jobApplication.findUnique({
      where: { jobId_userId: { jobId, userId: applicantId } },
      select: { userId: true },
    });
    if (!applied) {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        'That person has not applied to this job',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.listFor(applicantId);
  }

  /**
   * Walk the whole ledger and report whether it is intact.
   *
   * Offered as its own action because it answers a different question from
   * "is this credential valid": one asks about a row, this asks whether the
   * record as a whole has been interfered with. A sceptical recruiter — or
   * an auditor — should be able to ask the second without taking the first
   * on trust.
   */
  async checkLedger(): Promise<LedgerReport> {
    const rows = await this.prisma.credential.findMany({
      orderBy: { index: 'asc' },
      include: { issuer: true },
    });

    let expectedPrev = GENESIS;
    for (const [position, row] of rows.entries()) {
      if (row.index !== position) {
        return broken(rows.length, row.index, `Entry ${row.index} is out of sequence.`);
      }
      if (row.prevHash !== expectedPrev) {
        return broken(
          rows.length,
          row.index,
          `Entry ${row.index} does not follow the one before it.`,
        );
      }
      if (!hashesHold(row)) {
        return broken(rows.length, row.index, `Entry ${row.index} has been altered.`);
      }
      if (!signatureHolds(row, row.issuer)) {
        return broken(
          rows.length,
          row.index,
          `Entry ${row.index} was not signed by the issuer it names.`,
        );
      }
      expectedPrev = row.hash;
    }

    return {
      length: rows.length,
      intact: true,
      brokenAt: null,
      detail:
        rows.length === 0
          ? 'The ledger is empty. Nothing has been issued yet.'
          : `All ${rows.length} entries check out: each is signed by the issuer it names and follows the one before it.`,
    };
  }

  // --- the checking ---

  private async listFor(subjectId: string): Promise<CredentialList> {
    const [rows, ledgerLength] = await Promise.all([
      this.prisma.credential.findMany({
        where: { subjectId },
        orderBy: { issuedAt: 'desc' },
        include: { issuer: true },
      }),
      this.prisma.credential.count(),
    ]);

    // The link check needs the entry before each one, and a person's own
    // credentials are scattered through a ledger that holds everybody's.
    const previous = await this.prisma.credential.findMany({
      where: { index: { in: rows.map((row) => row.index - 1).filter((i) => i >= 0) } },
      select: { index: true, hash: true },
    });
    const hashByIndex = new Map(previous.map((row) => [row.index, row.hash]));

    const credentials = rows.map((row) => this.check(row, row.issuer, hashByIndex));

    return {
      credentials,
      validCount: credentials.filter((one) => one.valid).length,
      // See the class note. Said plainly rather than implied.
      anchored: false,
      ledgerLength,
    };
  }

  /**
   * The five checks, each reported separately.
   *
   * Separately, and this matters more than it looks. A single green tick
   * teaches a recruiter to stop reading; five lines teach them what was
   * actually established. "Signed by Dhaka University's key" and "that key
   * belongs to Dhaka University" are different claims, and only the first is
   * cryptographic — so they are never merged.
   */
  private check(
    row: Row,
    issuer: Issuer,
    hashByIndex: Map<number, string>,
  ): Credential {
    const hashOk = hashesHold(row);
    const signatureOk =
      contentHashOf(row) === row.contentHash && signatureHolds(row, issuer);

    const expectedPrev = row.index === 0 ? GENESIS : hashByIndex.get(row.index - 1);
    const chainOk =
      row.index === 0
        ? row.prevHash === GENESIS
        : expectedPrev === undefined
          ? false
          : row.prevHash === expectedPrev;

    const checks: CredentialCheck[] = [
      {
        key: 'hash',
        ok: hashOk,
        detail: hashOk
          ? 'The contents match the fingerprint taken when it was issued.'
          : 'The contents do not match the fingerprint. Something has been changed.',
      },
      {
        key: 'signature',
        ok: signatureOk,
        detail: signatureOk
          ? `Signed by ${issuer.name}'s own key. We could not have made this signature.`
          : hashOk
            ? 'The signature does not match the issuer key on file.'
            : 'Not checked: the contents were already altered.',
      },
      {
        key: 'issuer',
        ok: Boolean(issuer.approvedAt),
        detail: issuer.approvedAt
          ? `${issuer.name} is a registered issuer on WorkFlex BD.`
          : `${issuer.name} has not yet been confirmed as the owner of this key. The signature is sound; who holds the key is not yet established.`,
      },
      {
        key: 'chain',
        ok: chainOk,
        detail: chainOk
          ? `Entry ${row.index} in the record, correctly linked to the one before it.`
          : 'This entry does not link to the one before it in the record.',
      },
      {
        key: 'revocation',
        ok: row.revokedAt === null,
        detail:
          row.revokedAt === null
            ? 'Not withdrawn by the issuer.'
            : `Withdrawn by the issuer${row.revokeReason ? `: ${row.revokeReason}` : '.'}`,
      },
    ];

    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      field: row.field,
      grade: row.grade,
      startDate: row.startDate?.toISOString() ?? null,
      endDate: row.endDate?.toISOString() ?? null,
      issuedAt: row.issuedAt.toISOString(),
      issuer: toIssuer(issuer),
      index: row.index,
      hash: row.hash,
      revoked: row.revokedAt !== null,
      revokeReason: row.revokeReason,
      valid: checks.every((one) => one.ok),
      checks,
    };
  }
}

// --- the cryptography ---

/**
 * The exact bytes an issuer signs.
 *
 * Canonical, meaning: fixed field order, fixed date format, and no
 * whitespace that could differ between two machines. If this function ever
 * changes, every existing signature stops verifying — which is correct
 * behaviour, and the reason the format is written out by hand here rather
 * than left to `JSON.stringify` over an object whose key order is an
 * accident of how it was built.
 *
 * Note what is *not* in it: the ledger position. A university signing a
 * degree cannot know where in a queue it will land, and should not have to
 * ask. The position is bound in separately by `ledgerHash`, which is what
 * makes offline signing and an append-only chain possible at the same time.
 */
export function contentPayload(row: {
  subjectId: string;
  issuerId: string;
  kind: string;
  title: string;
  field: string | null;
  grade: string | null;
  startDate: Date | null;
  endDate: Date | null;
  claims: Prisma.JsonValue | null;
}): string {
  return [
    `v1`,
    `subject:${row.subjectId}`,
    `issuer:${row.issuerId}`,
    `kind:${row.kind}`,
    `title:${row.title.trim()}`,
    `field:${row.field?.trim() ?? ''}`,
    `grade:${row.grade?.trim() ?? ''}`,
    `start:${row.startDate?.toISOString() ?? ''}`,
    `end:${row.endDate?.toISOString() ?? ''}`,
    `claims:${row.claims === null ? '' : JSON.stringify(row.claims)}`,
  ].join('\n');
}

export function contentHashOf(row: Parameters<typeof contentPayload>[0]): string {
  return createHash('sha256').update(contentPayload(row), 'utf8').digest('hex');
}

/**
 * The hash the chain links: the contents, bound to where they sit.
 *
 * Including `prevHash` is what makes the record append-only — recomputing
 * any earlier entry changes this, and every entry after it stops matching.
 */
export function ledgerHash(parts: {
  contentHash: string;
  index: number;
  prevHash: string;
  issuedAt: Date;
}): string {
  return createHash('sha256')
    .update(
      [
        `v1`,
        `content:${parts.contentHash}`,
        `index:${parts.index}`,
        `prev:${parts.prevHash}`,
        `issued:${parts.issuedAt.toISOString()}`,
      ].join('\n'),
      'utf8',
    )
    .digest('hex');
}

/**
 * Whether the issuer's key really produced this signature.
 *
 * Wrapped in a try/catch because a malformed key or signature makes the
 * crypto library throw rather than return false, and a credential with
 * rubbish in its signature field is simply invalid — not a 500.
 */
export function signatureHolds(
  row: { contentHash: string; signature: string },
  issuer: { publicKey: string },
): boolean {
  try {
    const key = createPublicKey({
      key: Buffer.from(issuer.publicKey, 'base64url'),
      format: 'der',
      type: 'spki',
    });
    return verifySignature(
      null,
      Buffer.from(row.contentHash, 'utf8'),
      key,
      Buffer.from(row.signature, 'base64url'),
    );
  } catch {
    return false;
  }
}

/**
 * Both hashes, recomputed from the row itself.
 *
 * Either failing means the stored contents no longer produce the stored
 * fingerprints, which is exactly what an edited row looks like.
 */
function hashesHold(row: {
  subjectId: string;
  issuerId: string;
  kind: string;
  title: string;
  field: string | null;
  grade: string | null;
  startDate: Date | null;
  endDate: Date | null;
  claims: Prisma.JsonValue | null;
  contentHash: string;
  index: number;
  prevHash: string;
  issuedAt: Date;
  hash: string;
}): boolean {
  if (contentHashOf(row) !== row.contentHash) return false;
  return ledgerHash(row) === row.hash;
}

function toIssuer(issuer: Issuer): CredentialIssuer {
  return {
    id: issuer.id,
    name: issuer.name,
    kind: issuer.kind,
    did: issuer.did,
    website: issuer.website,
    approved: issuer.approvedAt !== null,
  };
}

function broken(length: number, at: number, detail: string): LedgerReport {
  return { length, intact: false, brokenAt: at, detail };
}
