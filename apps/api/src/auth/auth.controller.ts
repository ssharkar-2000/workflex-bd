import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  loginSchema,
  logoutSchema,
  otpRequestSchema,
  otpVerifySchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  refreshSchema,
  type LoginDto,
  type LogoutDto,
  type OtpRequestDto,
  type OtpVerifyDto,
  type PasswordResetConfirmDto,
  type PasswordResetRequestDto,
  type RefreshDto,
} from '@workflex/shared';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CurrentUser,
  type RequestWithUser,
} from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import type { SessionContext } from './token.service';

/**
 * The @ApiBody schemas below are hand-written. Validation is still driven
 * entirely by the zod schemas in @workflex/shared — these only tell Swagger
 * what to render, since it cannot introspect zod. Keep them in step when the
 * shared schemas change.
 */
const PURPOSES = ['LOGIN', 'PHONE_CHANGE', 'PASSWORD_RESET'];

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private sessionContext(
    req: RequestWithUser,
    deviceId?: string,
  ): SessionContext {
    return {
      deviceId,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    };
  }

  /**
   * Tight limit: each call sends a real SMS that costs money, and an
   * unthrottled endpoint is an easy way to bill us for someone else's spam.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a login code by SMS' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['phone'],
      properties: {
        phone: {
          type: 'string',
          example: '01712345678',
          description:
            'Bangladeshi mobile number. 01XXXXXXXXX, 8801XXXXXXXXX and +8801XXXXXXXXX are all accepted.',
        },
        purpose: { type: 'string', enum: PURPOSES, default: 'LOGIN' },
      },
    },
  })
  async requestOtp(
    @Body(new ZodValidationPipe(otpRequestSchema)) dto: OtpRequestDto,
  ) {
    return this.auth.requestOtp(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a login code; creates the account if new' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['phone', 'code'],
      properties: {
        phone: { type: 'string', example: '01712345678' },
        code: {
          type: 'string',
          example: '123456',
          description: 'The 6-digit code from the SMS (or the API log in dev).',
        },
        purpose: { type: 'string', enum: PURPOSES, default: 'LOGIN' },
        deviceId: {
          type: 'string',
          description:
            'Stable per-install id, so one device can be signed out on its own.',
          nullable: true,
        },
      },
    },
  })
  async verifyOtp(
    @Body(new ZodValidationPipe(otpVerifySchema)) dto: OtpVerifyDto,
    @Req() req: RequestWithUser,
  ) {
    return this.auth.verifyOtp(dto, this.sessionContext(req, dto.deviceId));
  }

  /**
   * Password sign-in. Throttled harder than the OTP endpoints because this is
   * the one an attacker would use to guess passwords.
   */
  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with mobile number and password' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['phone', 'password'],
      properties: {
        phone: { type: 'string', example: '01712345678' },
        password: { type: 'string', example: 'Workflex@2026' },
        deviceId: { type: 'string', nullable: true },
      },
    },
  })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Req() req: RequestWithUser,
  ) {
    return this.auth.login(dto, this.sessionContext(req, dto.deviceId));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/reset/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a password-reset code by SMS' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['phone'],
      properties: { phone: { type: 'string', example: '01712345678' } },
    },
  })
  async requestPasswordReset(
    @Body(new ZodValidationPipe(passwordResetRequestSchema))
    dto: PasswordResetRequestDto,
  ) {
    return this.auth.requestPasswordReset(dto.phone);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('password/reset/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Set a new password using the SMS code' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['phone', 'code', 'password', 'confirmPassword'],
      properties: {
        phone: { type: 'string', example: '01712345678' },
        code: { type: 'string', example: '123456' },
        password: { type: 'string', example: 'Workflex@2026' },
        confirmPassword: { type: 'string', example: 'Workflex@2026' },
      },
    },
  })
  async confirmPasswordReset(
    @Body(new ZodValidationPipe(passwordResetConfirmSchema))
    dto: PasswordResetConfirmDto,
  ): Promise<void> {
    await this.auth.confirmPasswordReset(dto);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token for a new token pair' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['refreshToken'],
      properties: {
        refreshToken: { type: 'string', example: 'paste-a-refresh-token-here' },
      },
    },
  })
  async refresh(
    @Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto,
    @Req() req: RequestWithUser,
  ) {
    return this.auth.refresh(dto, this.sessionContext(req));
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current session, or all sessions' })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        refreshToken: { type: 'string', nullable: true },
        allDevices: { type: 'boolean', default: false },
      },
    },
  })
  async logout(
    @Body(new ZodValidationPipe(logoutSchema)) dto: LogoutDto,
    @CurrentUser('userId') userId: string,
  ): Promise<void> {
    await this.auth.logout(dto, userId);
  }
}
