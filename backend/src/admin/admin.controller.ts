import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

class UpdateAdminDto {
  @IsOptional() @IsString() @MaxLength(80) displayName?: string;
  @IsOptional() @IsIn(['en', 'bn']) language?: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  me(@CurrentUser() admin: unknown) {
    return admin;
  }

  @Patch('me')
  update(@CurrentUser() admin: { id: string }, @Body() dto: UpdateAdminDto) {
    return this.prisma.adminUser.update({
      where: { id: admin.id },
      data: dto,
      select: { id: true, email: true, displayName: true, role: true, language: true },
    });
  }
}
