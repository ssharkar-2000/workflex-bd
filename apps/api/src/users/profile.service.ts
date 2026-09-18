import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Jimp } from 'jimp';
import {
  ApiErrorCode,
  type KycStatus,
  type MyProfile,
  type ProfileUpdateDto,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { StorageService } from '../storage/storage.service';

/** Avatar edge length. Comfortably covers a 50pt circle at 3x density. */
const AVATAR_PX = 160;

/**
 * Reading and editing the details captured at registration.
 *
 * The one real constraint here is the legal name. Once an application is in
 * front of a reviewer, or has been approved, the name on file is the name
 * that was checked against the NID — letting it be edited afterwards would
 * leave an account whose verified level no longer matches its own claims,
 * silently. Everything else (address, designation, company details) is
 * correctable at any time, which is what people actually need.
 */
@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * The verification selfie, resized for the dashboard avatar.
   *
   * The stored original is ~1 MB, which is absurd to push through a 50pt
   * circle — and the client has to hold it in memory as a base64 string to
   * get an auth header onto the request at all. Resizing here keeps that
   * under ~10 KB.
   */
  async avatar(userId: string): Promise<{ data: Buffer; mimeType: string }> {
    const doc = await this.prisma.document.findUnique({
      where: { userId_kind: { userId, kind: 'SELFIE' } },
    });
    if (!doc) throw AppException.notFound('No photo on this account');

    const original = await this.storage.read(doc.storageKey);

    try {
      const image = await Jimp.read(original);
      // cover() rather than scaleToFit(): the avatar is a circle, so filling
      // it and cropping the edges beats letterboxing a portrait photo.
      image.cover({ w: AVATAR_PX, h: AVATAR_PX });
      return {
        data: await image.getBuffer('image/jpeg', { quality: 82 }),
        mimeType: 'image/jpeg',
      };
    } catch (err) {
      // A photo that will not decode should still not break the dashboard;
      // the original is served instead and the client scales it.
      this.logger.warn({ err, userId }, 'Could not resize avatar');
      return { data: original, mimeType: doc.mimeType };
    }
  }

  private async kycStatus(userId: string): Promise<KycStatus> {
    const submission = await this.prisma.kycSubmission.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return (submission?.status ?? 'NOT_STARTED') as KycStatus;
  }

  private nameLocked(status: KycStatus): boolean {
    return status === 'PENDING_REVIEW' || status === 'APPROVED';
  }

  async get(userId: string): Promise<MyProfile> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { company: true },
    });
    const status = await this.kycStatus(userId);

    return {
      accountType: user.accountType,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      address: user.address,
      designation: user.designation,
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      company: user.company
        ? {
            name: user.company.name,
            registrationNumber: user.company.registrationNumber,
            tin: user.company.tin,
            tradeLicenseNo: user.company.tradeLicenseNo,
          }
        : null,
      nameEditable: !this.nameLocked(status),
      kycStatus: status,
    };
  }

  async update(userId: string, dto: ProfileUpdateDto): Promise<MyProfile> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const status = await this.kycStatus(userId);

    const renaming =
      dto.firstName !== user.firstName || dto.lastName !== user.lastName;

    if (renaming && this.nameLocked(status)) {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        status === 'APPROVED'
          ? 'Your name was verified against your NID and cannot be changed here. Contact support if it is wrong.'
          : 'Your name cannot be changed while your documents are being reviewed.',
        HttpStatus.FORBIDDEN,
      );
    }

    const isCompany = user.accountType === 'COMPANY';

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        address: dto.address,
        // An individual has no designation to hold, so a value sent by a
        // stale client is dropped rather than stored where nothing reads it.
        designation: isCompany ? dto.designation || null : null,
      },
    });

    // Company rows are only touched for company accounts, and only updated —
    // never created here. A company that does not exist yet means registration
    // never completed, which is onboarding's job, not this endpoint's.
    if (isCompany && dto.companyName) {
      await this.prisma.company.updateMany({
        where: { ownerId: userId },
        data: {
          name: dto.companyName,
          registrationNumber: dto.companyRegistrationNumber || null,
          tin: dto.tin || null,
          tradeLicenseNo: dto.tradeLicenseNo || null,
        },
      });
    }

    this.logger.log(`Profile updated for user ${userId}`);
    return this.get(userId);
  }
}
