import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { paginate } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto, ListCompaniesDto, UpdateCompanyDto } from './dto/company.dto';

/// "Radisson Blu Dhaka" -> "R", matching the avatar letter on the job cards.
function initialsFor(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListCompaniesDto) {
    const where: Prisma.CompanyWhereInput = {
      ...(query.industry ? { industry: { equals: query.industry, mode: 'insensitive' } } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        include: { _count: { select: { jobs: true, employers: true } } },
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.company.count({ where }),
    ]);

    return paginate(items, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        employers: { select: { id: true, fullName: true, code: true, verified: true } },
        jobs: {
          select: { id: true, title: true, status: true, postedAt: true },
          orderBy: { postedAt: 'desc' },
          take: 10,
        },
        _count: { select: { jobs: true, employers: true } },
      },
    });
    if (!company) throw new NotFoundException('That company no longer exists.');
    return company;
  }

  async create(dto: CreateCompanyDto, adminId: string) {
    const company = await this.prisma.company.create({
      data: { ...dto, initials: initialsFor(dto.name) },
    });
    await this.audit.record({
      adminId,
      action: 'company.create',
      entityType: 'Company',
      entityId: company.id,
    });
    return company;
  }

  async update(id: string, dto: UpdateCompanyDto, adminId: string) {
    await this.findOne(id);
    const company = await this.prisma.company.update({
      where: { id },
      data: { ...dto, ...(dto.name ? { initials: initialsFor(dto.name) } : {}) },
    });
    await this.audit.record({
      adminId,
      action: 'company.update',
      entityType: 'Company',
      entityId: id,
      metadata: dto as Record<string, unknown>,
    });
    return company;
  }
}
