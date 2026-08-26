import { Body, Controller, Delete, Get, Patch, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  localeSchema,
  profileUpdateSchema,
  setEmailSchema,
  verifyEmailSchema,
  type Locale,
  type ProfileUpdateDto,
  type SetEmailDto,
  type VerifyEmailDto,
} from '@workflex/shared';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UsersService } from './users.service';
import { EmailVerificationService } from './email-verification.service';
import { ProfileService } from './profile.service';

const updateLocaleSchema = z.object({ locale: localeSchema });
type UpdateLocaleDto = z.output<typeof updateLocaleSchema>;

@ApiTags('users')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly emails: EmailVerificationService,
    private readonly profiles: ProfileService,
  ) {}

  /**
   * The app calls this on launch to decide where to route: onboarding,
   * a verification prompt, or the main tabs.
   */
  @Get('me')
  @ApiOperation({ summary: 'The signed-in user' })
  async me(@CurrentUser('userId') userId: string) {
    const user = await this.users.findById(userId);
    return this.users.toAuthUser(user);
  }

  @Patch('me/locale')
  @ApiOperation({ summary: 'Set the preferred language' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['locale'],
      properties: { locale: { type: 'string', enum: ['bn', 'en'] } },
    },
  })
  async setLocale(
    @Body(new ZodValidationPipe(updateLocaleSchema)) dto: UpdateLocaleDto,
    @CurrentUser('userId') userId: string,
  ) {
    const user = await this.users.setLocale(userId, dto.locale);
    return this.users.toAuthUser(user);
  }

  @Get('me/photo')
  @ApiOperation({ summary: 'Your verification selfie, resized for an avatar' })
  async photo(
    @CurrentUser('userId') userId: string,
    @Res() res: Response,
  ): Promise<void> {
    const photo = await this.profiles.avatar(userId);
    res.setHeader('Content-Type', photo.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(photo.data);
  }

  @Get('me/profile')
  @ApiOperation({ summary: 'Registration details, and whether they are editable' })
  async profile(@CurrentUser('userId') userId: string) {
    return this.profiles.get(userId);
  }

  /**
   * Password and email are not accepted here on purpose — both have their own
   * verified flows (/auth/password/reset/* and /me/email), and accepting them
   * on a plain profile save would be a way around those checks.
   */
  @Patch('me/profile')
  @ApiOperation({ summary: 'Update registration details' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['firstName', 'lastName', 'address'],
      properties: {
        firstName: { type: 'string', example: 'Susmita' },
        lastName: { type: 'string', example: 'Sarkar' },
        address: { type: 'string', example: 'House 12/A, Road 5, Dhaka' },
        designation: { type: 'string', example: 'Managing Director' },
        companyName: { type: 'string' },
        companyRegistrationNumber: { type: 'string' },
        tin: { type: 'string' },
        tradeLicenseNo: { type: 'string' },
      },
    },
  })
  async updateProfile(
    @Body(new ZodValidationPipe(profileUpdateSchema)) dto: ProfileUpdateDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.profiles.update(userId, dto);
  }

  @Get('me/email')
  @ApiOperation({ summary: 'Email address and verification state' })
  async emailStatus(@CurrentUser('userId') userId: string) {
    return this.emails.status(userId);
  }

  /**
   * Optional. Phone verification remains the mandatory identity check —
   * adding an email grants no verification level on its own.
   */
  @Post('me/email')
  @ApiOperation({ summary: 'Add or change an email, sending a code to it' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', example: 'someone@example.com' },
      },
    },
  })
  async setEmail(
    @Body(new ZodValidationPipe(setEmailSchema)) dto: SetEmailDto,
    @CurrentUser('userId') userId: string,
  ) {
    const user = await this.users.findById(userId);
    return this.emails.request(userId, dto.email, user.locale as Locale);
  }

  @Post('me/email/verify')
  @ApiOperation({ summary: 'Confirm the emailed code' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['code'],
      properties: { code: { type: 'string', example: '123456' } },
    },
  })
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) dto: VerifyEmailDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.emails.verify(userId, dto.code);
  }

  @Delete('me/email')
  @ApiOperation({ summary: 'Unlink the email address' })
  async removeEmail(@CurrentUser('userId') userId: string) {
    return this.emails.remove(userId);
  }
}
