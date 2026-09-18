import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { DocumentKind } from '@prisma/client';
import {
  documentKindSchema,
  onboardingProfileSchema,
  type Locale,
  type OnboardingProfileDto,
} from '@workflex/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AppException } from '../common/exceptions/app.exception';
import { UsersService } from '../users/users.service';
import { OnboardingService } from './onboarding.service';

@ApiTags('onboarding')
@ApiBearerAuth()
@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly users: UsersService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Registration progress and what is still missing' })
  async status(@CurrentUser('userId') userId: string) {
    return this.onboarding.getStatus(userId);
  }

  @Post('profile')
  @ApiOperation({ summary: 'Save registration details' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: [
        'accountType',
        'firstName',
        'lastName',
        'address',
        'password',
        'confirmPassword',
      ],
      properties: {
        accountType: { type: 'string', enum: ['INDIVIDUAL', 'COMPANY'] },
        firstName: { type: 'string', example: 'Rahim' },
        lastName: { type: 'string', example: 'Uddin' },
        address: { type: 'string', example: 'House 12, Road 5, Dhanmondi, Dhaka' },
        password: {
          type: 'string',
          description:
            '8+ chars with a capital, a small letter, a digit and a special character',
          example: 'Workflex@2026',
        },
        confirmPassword: { type: 'string', example: 'Workflex@2026' },
        companyName: {
          type: 'string',
          description: 'Required when accountType is COMPANY',
          nullable: true,
        },
        companyRegistrationNumber: {
          type: 'string',
          description: 'RJSC number. Required when accountType is COMPANY',
          nullable: true,
        },
        designation: {
          type: 'string',
          description: 'Role at the company. Required when accountType is COMPANY',
          example: 'HR Manager',
          nullable: true,
        },
        email: {
          type: 'string',
          description: 'Optional. Triggers an email verification code if given.',
          nullable: true,
        },
        tin: { type: 'string', nullable: true },
        tradeLicenseNo: { type: 'string', nullable: true },
      },
    },
  })
  async saveProfile(
    @Body(new ZodValidationPipe(onboardingProfileSchema))
    dto: OnboardingProfileDto,
    @CurrentUser('userId') userId: string,
  ) {
    const user = await this.users.findById(userId);
    return this.onboarding.saveProfile(userId, dto, user.locale as Locale);
  }

  @Post('documents/:kind')
  @ApiOperation({ summary: 'Upload or replace one document' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'kind',
    enum: ['NID_FRONT', 'NID_BACK', 'SELFIE', 'TIN_CERTIFICATE', 'TRADE_LICENSE'],
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  // Kept in memory rather than written by multer: the file is validated and
  // then handed to StorageService, so nothing untrusted is ever written to a
  // path multer chose.
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('kind') kindParam: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser('userId') userId: string,
  ) {
    const kind = documentKindSchema.safeParse(kindParam);
    if (!kind.success) throw AppException.notFound('Unknown document kind');
    if (!file) throw AppException.notFound('No file was uploaded');

    return this.onboarding.uploadDocument(userId, kind.data as DocumentKind, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
  }

  /** Lets the applicant see what they uploaded. Own documents only. */
  @Get('documents/:kind')
  @ApiOperation({ summary: 'Fetch one of your own uploaded documents' })
  async download(
    @Param('kind') kindParam: string,
    @CurrentUser('userId') userId: string,
    @Res() res: Response,
  ): Promise<void> {
    const kind = documentKindSchema.safeParse(kindParam);
    if (!kind.success) throw AppException.notFound('Unknown document kind');

    const doc = await this.onboarding.readDocument(
      userId,
      kind.data as DocumentKind,
    );

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(doc.data);
  }

  @Post('submit')
  @ApiOperation({ summary: 'Send the application for review' })
  async submit(@CurrentUser('userId') userId: string) {
    return this.onboarding.submit(userId);
  }
}
