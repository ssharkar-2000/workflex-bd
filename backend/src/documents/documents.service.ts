import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentOwnerType, Prisma } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentDto, ListDocumentsDto } from './dto/document.dto';

/**
 * Item 11 — "document storage hoye thakbe based on user id + job id and user
 * full info dakabe."
 *
 * Two rules drive this file:
 *
 * 1. **The storage key is derived, never typed.** Every document lands at
 *    `worker/<workerId>/job/<jobId>/<kind>/<fileName>` (or `.../general/...`
 *    when it isn't tied to a job). Because the key is built from the ids
 *    rather than supplied by the caller, "every document for this user on
 *    this job" is a prefix query, the bucket layout matches the database
 *    exactly, and re-uploading the same file for the same user and job hits
 *    the unique constraint instead of silently creating a second copy.
 *
 * 2. **The listing carries the owner's full profile.** The point of opening
 *    this screen is to check a document against the person it belongs to, so
 *    `byUser()` returns the worker's or employer's own record next to the
 *    documents — no second round trip, and no chance of reading a document
 *    against the wrong profile.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /// Path-safe file name: keeps the extension, strips anything that would
  /// break a storage key or let a caller climb out of their own prefix.
  private slug(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
  }

  private buildStorageKey(params: {
    ownerType: DocumentOwnerType;
    userId: string;
    jobId?: string | null;
    kind: string;
    fileName: string;
  }): string {
    const scope = params.ownerType === DocumentOwnerType.WORKER ? 'worker' : 'employer';
    const jobPart = params.jobId ? `job/${params.jobId}` : 'general';
    return `${scope}/${params.userId}/${jobPart}/${params.kind.toLowerCase()}/${this.slug(params.fileName)}`;
  }

  async list(query: ListDocumentsDto) {
    const where: Prisma.StoredDocumentWhereInput = {
      ...(query.workerId ? { workerId: query.workerId } : {}),
      ...(query.employerId ? { employerId: query.employerId } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.search ? { fileName: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    return this.prisma.storedDocument.findMany({
      where,
      orderBy: { uploadedAt: 'desc' },
      include: {
        job: { select: { id: true, code: true, title: true } },
        worker: { select: { id: true, code: true, fullName: true } },
        employer: { select: { id: true, code: true, fullName: true } },
      },
    });
  }

  /**
   * Everything filed under one user, grouped by job — the shape the screen
   * renders directly. `jobId` narrows it to a single job's folder.
   */
  async byUser(params: { workerId?: string; employerId?: string; jobId?: string }) {
    if (!params.workerId && !params.employerId) {
      throw new BadRequestException('Ask for documents by worker or by employer.');
    }

    const owner = params.workerId
      ? await this.prisma.worker.findUnique({
          where: { id: params.workerId },
          // The whole profile, because the point of this screen is to check a
          // document against the person it belongs to.
          include: {
            skills: { select: { name: true } },
            certifications: true,
            jobHistory: { orderBy: { startedAt: 'desc' } },
          },
        })
      : await this.prisma.employer.findUnique({
          where: { id: params.employerId },
          include: { company: { select: { id: true, name: true, industry: true, address: true, verified: true } } },
        });

    if (!owner) throw new NotFoundException('That user no longer exists.');

    const documents = await this.prisma.storedDocument.findMany({
      where: {
        ...(params.workerId ? { workerId: params.workerId } : { employerId: params.employerId }),
        ...(params.jobId ? { jobId: params.jobId } : {}),
      },
      orderBy: [{ jobId: 'asc' }, { uploadedAt: 'desc' }],
      include: { job: { select: { id: true, code: true, title: true } } },
    });

    // Grouped so the screen can render one folder per job plus a "general"
    // folder, which is how the files are laid out in storage too.
    const groups = new Map<
      string,
      { jobId: string | null; job: { id: string; code: string; title: string } | null; documents: typeof documents }
    >();
    for (const doc of documents) {
      const key = doc.jobId ?? 'general';
      const group = groups.get(key) ?? { jobId: doc.jobId, job: doc.job, documents: [] };
      group.documents.push(doc);
      groups.set(key, group);
    }

    return {
      ownerType: params.workerId ? DocumentOwnerType.WORKER : DocumentOwnerType.EMPLOYER,
      user: owner,
      total: documents.length,
      groups: [...groups.values()],
    };
  }

  async findOne(id: string) {
    const doc = await this.prisma.storedDocument.findUnique({
      where: { id },
      include: {
        job: { select: { id: true, code: true, title: true } },
        worker: { select: { id: true, code: true, fullName: true } },
        employer: { select: { id: true, code: true, fullName: true } },
      },
    });
    if (!doc) throw new NotFoundException('That document no longer exists.');
    return doc;
  }

  async create(dto: CreateDocumentDto, adminId: string) {
    if (!dto.workerId && !dto.employerId) {
      throw new BadRequestException('A document has to belong to a worker or an employer.');
    }
    if (dto.workerId && dto.employerId) {
      throw new BadRequestException('A document belongs to one user, not both.');
    }

    const ownerType = dto.workerId ? DocumentOwnerType.WORKER : DocumentOwnerType.EMPLOYER;
    const userId = (dto.workerId ?? dto.employerId)!;

    // Fail before writing rather than leaving a row pointing at a user or job
    // that isn't there.
    if (dto.workerId) {
      const worker = await this.prisma.worker.findUnique({ where: { id: dto.workerId }, select: { id: true } });
      if (!worker) throw new NotFoundException('That worker no longer exists.');
    } else {
      const employer = await this.prisma.employer.findUnique({
        where: { id: dto.employerId },
        select: { id: true },
      });
      if (!employer) throw new NotFoundException('That employer no longer exists.');
    }
    if (dto.jobId) {
      const job = await this.prisma.job.findUnique({ where: { id: dto.jobId }, select: { id: true } });
      if (!job) throw new NotFoundException('That job no longer exists.');
    }

    const storageKey = this.buildStorageKey({
      ownerType,
      userId,
      jobId: dto.jobId,
      kind: dto.kind ?? 'OTHER',
      fileName: dto.fileName,
    });

    const existing = await this.prisma.storedDocument.findUnique({ where: { storageKey } });
    if (existing) {
      throw new BadRequestException(
        'A file with this name is already filed under this user and job. Rename it or remove the old one first.',
      );
    }

    const document = await this.prisma.storedDocument.create({
      data: {
        ownerType,
        workerId: dto.workerId ?? null,
        employerId: dto.employerId ?? null,
        jobId: dto.jobId ?? null,
        kind: dto.kind,
        fileName: dto.fileName.trim(),
        storageKey,
        url: dto.url?.trim() || null,
        mimeType: dto.mimeType?.trim() || null,
        sizeBytes: dto.sizeBytes ?? null,
        note: dto.note?.trim() || null,
        uploadedByAdminId: adminId,
      },
      include: { job: { select: { id: true, code: true, title: true } } },
    });

    await this.audit.record({
      adminId,
      action: 'document.create',
      entityType: 'StoredDocument',
      entityId: document.id,
      metadata: { storageKey, jobId: dto.jobId ?? null },
    });

    return document;
  }

  async remove(id: string, adminId: string) {
    const doc = await this.findOne(id);
    await this.prisma.storedDocument.delete({ where: { id } });
    await this.audit.record({
      adminId,
      action: 'document.delete',
      entityType: 'StoredDocument',
      entityId: id,
      metadata: { storageKey: doc.storageKey },
    });
    return { id, deleted: true };
  }
}
