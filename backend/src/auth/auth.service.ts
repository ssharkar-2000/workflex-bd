import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SignInDto } from './dto/auth.dto';

const REFRESH_TTL_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async signIn(dto: SignInDto) {
    const admin = await this.prisma.adminUser.findUnique({ where: { email: dto.email } });
    if (!admin || !(await argon2.verify(admin.passwordHash, dto.password))) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    return this.issueTokens(admin.id, admin.email);
  }

  async refresh(rawToken: string) {
    const [id, secret] = rawToken.split('.');
    if (!id || !secret) throw new UnauthorizedException('Refresh token is malformed.');

    const record = await this.prisma.refreshToken.findUnique({ where: { id } });
    if (
      !record ||
      record.revokedAt ||
      record.expiresAt < new Date() ||
      !(await argon2.verify(record.tokenHash, secret))
    ) {
      throw new UnauthorizedException('Refresh token is no longer valid.');
    }

    await this.prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
    const admin = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: record.adminId } });
    return this.issueTokens(admin.id, admin.email);
  }

  async signOut(adminId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { adminId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { signedOut: true };
  }

  private async issueTokens(adminId: string, email: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: adminId, email },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: process.env.JWT_ACCESS_TTL ?? '15m' },
    );

    const secret = randomBytes(32).toString('hex');
    const record = await this.prisma.refreshToken.create({
      data: {
        adminId,
        tokenHash: await argon2.hash(secret),
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 864e5),
      },
    });

    return { accessToken, refreshToken: `${record.id}.${secret}` };
  }
}
