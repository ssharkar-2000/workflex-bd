import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { CredentialKind } from '@prisma/client';
import { ApiErrorCode } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import {
  GENESIS,
  contentHashOf,
  ledgerHash,
  signatureHolds,
} from './credentials.service';

/** What an institution sends when it attests to something. */
export type IssueInput = {
  issuerId: string;
  subjectId: string;
  kind: CredentialKind;
  title: string;
  field?: string | null;
  grade?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  claims?: unknown;
  /** ed25519 over the content hash, base64url. */
  signature: string;
};

/**
 * Appending to the ledger.
 *
 * The institution signs; this only files. That division is the whole design:
 * the signature arrives already made, over a hash the institution computed
 * itself, with a key this server has never held. All that happens here is
 * that the signature is checked against the registered public key and, if it
 * holds, the credential is given the next position in the chain.
 *
 * A credential whose signature does not verify is refused outright rather
 * than stored as invalid. An unsigned row in an append-only ledger is worse
 * than no row: it occupies a position, links the entries either side of it,
 * and looks from a distance like a record.
 */
@Injectable()
export class IssuingService {
  private readonly logger = new Logger(IssuingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async issue(input: IssueInput) {
    const issuer = await this.prisma.issuer.findUnique({ where: { id: input.issuerId } });
    if (!issuer) {
      throw AppException.notFound('No such issuer');
    }

    const subject = await this.prisma.user.findUnique({
      where: { id: input.subjectId },
      select: { id: true },
    });
    if (!subject) {
      throw AppException.notFound('No such person');
    }

    const content = {
      subjectId: input.subjectId,
      issuerId: input.issuerId,
      kind: input.kind,
      title: input.title,
      field: input.field ?? null,
      grade: input.grade ?? null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      claims: (input.claims ?? null) as never,
    };
    const contentHash = contentHashOf(content);

    if (!signatureHolds({ contentHash, signature: input.signature }, issuer)) {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        'That signature does not match the issuer key on file',
        HttpStatus.FORBIDDEN,
      );
    }

    /**
     * The whole append in one transaction, at the strictest isolation
     * Postgres offers.
     *
     * Two credentials issued in the same instant would otherwise both read
     * the same head, claim the same index, and one would win on the unique
     * constraint while the other's hash chain silently pointed at a row that
     * is no longer its predecessor. Serializable makes the loser fail
     * outright, which is the correct outcome: an append-only record that
     * races is not append-only.
     */
    return this.prisma.$transaction(
      async (tx) => {
        const head = await tx.credential.findFirst({
          orderBy: { index: 'desc' },
          select: { index: true, hash: true },
        });

        const index = head ? head.index + 1 : 0;
        const prevHash = head ? head.hash : GENESIS;
        const issuedAt = new Date();
        const hash = ledgerHash({ contentHash, index, prevHash, issuedAt });

        const created = await tx.credential.create({
          data: {
            ...content,
            contentHash,
            index,
            prevHash,
            hash,
            signature: input.signature,
            issuedAt,
          },
          select: { id: true, index: true, hash: true },
        });

        this.logger.log(`Credential ${created.id} filed at index ${created.index}`);
        return created;
      },
      { isolationLevel: 'Serializable' },
    );
  }

  /**
   * Withdrawing a credential.
   *
   * Marked, never deleted. A row that vanishes cannot be told apart from one
   * that never existed, and removing it would break every link after it —
   * the chain would report itself as tampered with, which it would be.
   */
  async revoke(issuerId: string, credentialId: string, reason: string) {
    const row = await this.prisma.credential.findUnique({
      where: { id: credentialId },
      select: { issuerId: true, revokedAt: true },
    });
    if (!row || row.issuerId !== issuerId) {
      throw AppException.notFound('No such credential');
    }
    if (row.revokedAt) {
      throw new AppException(
        ApiErrorCode.ALREADY_PROCESSED,
        'That credential is already withdrawn',
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.credential.update({
      where: { id: credentialId },
      data: { revokedAt: new Date(), revokeReason: reason.trim() },
    });
    this.logger.log(`Credential ${credentialId} withdrawn by issuer ${issuerId}`);
  }
}
