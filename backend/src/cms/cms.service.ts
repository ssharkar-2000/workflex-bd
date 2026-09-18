import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { paginate } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCmsBlockDto, ListCmsDto, UpdateCmsBlockDto } from './dto/cms.dto';

@Injectable()
export class CmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListCmsDto) {
    const where: Prisma.CmsBlockWhereInput = {
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.cmsBlock.findMany({
        where,
        orderBy: [{ kind: 'asc' }, { position: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.cmsBlock.count({ where }),
    ]);

    return paginate(items, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const block = await this.prisma.cmsBlock.findUnique({ where: { id } });
    if (!block) throw new NotFoundException('That content block no longer exists.');
    return block;
  }

  async create(dto: CreateCmsBlockDto, adminId: string) {
    const existing = await this.prisma.cmsBlock.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('That slug is already in use.');

    const block = await this.prisma.cmsBlock.create({ data: dto });
    await this.audit.record({
      adminId,
      action: 'cms.create',
      entityType: 'CmsBlock',
      entityId: block.id,
    });
    return block;
  }

  async update(id: string, dto: UpdateCmsBlockDto, adminId: string) {
    await this.findOne(id);
    const block = await this.prisma.cmsBlock.update({ where: { id }, data: dto });
    await this.audit.record({
      adminId,
      action: dto.published === undefined ? 'cms.update' : `cms.${dto.published ? 'publish' : 'unpublish'}`,
      entityType: 'CmsBlock',
      entityId: id,
    });
    return block;
  }

  async remove(id: string, adminId: string) {
    await this.findOne(id);
    await this.prisma.cmsBlock.delete({ where: { id } });
    await this.audit.record({
      adminId,
      action: 'cms.delete',
      entityType: 'CmsBlock',
      entityId: id,
    });
    return { deleted: true };
  }
}
