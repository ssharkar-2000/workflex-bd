import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { paginate } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployerDto, ListEmployersDto, UpdateEmployerDto } from './dto/employer.dto';

@Injectable()
export class EmployersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListEmployersDto) {
    const where: Prisma.EmployerWhereInput = {
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.verified !== undefined ? { verified: query.verified === 'true' } : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.employer.findMany({
        where,
        include: { company: { select: { id: true, name: true, initials: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.employer.count({ where }),
    ]);

    return paginate(items, total, query.page, query.limit);
  }

  async counts() {
    const [total, verified] = await this.prisma.$transaction([
      this.prisma.employer.count(),
      this.prisma.employer.count({ where: { verified: true } }),
    ]);
    return { total, verified, unverified: total - verified };
  }

  async findOne(id: string) {
    const employer = await this.prisma.employer.findUnique({
      where: { id },
      include: {
        company: true,
        verifications: { orderBy: { submittedAt: 'desc' }, take: 5 },
      },
    });
    if (!employer) throw new NotFoundException('That employer no longer exists.');
    return employer;
  }

  async create(dto: CreateEmployerDto, adminId: string) {
    const existing = await this.prisma.employer.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('An employer with that email already exists.');

    const count = await this.prisma.employer.count();
    const employer = await this.prisma.employer.create({
      data: { ...dto, code: `EM-${String(count + 1).padStart(3, '0')}` },
    });

    await this.audit.record({
      adminId,
      action: 'employer.create',
      entityType: 'Employer',
      entityId: employer.id,
    });
    return employer;
  }

  async update(id: string, dto: UpdateEmployerDto, adminId: string) {
    await this.findOne(id);
    const employer = await this.prisma.employer.update({ where: { id }, data: dto });
    await this.audit.record({
      adminId,
      action: 'employer.update',
      entityType: 'Employer',
      entityId: id,
      metadata: dto as Record<string, unknown>,
    });
    return employer;
  }
}
