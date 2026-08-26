import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { adminLoginSchema, type AdminAuthTokens, type AdminLoginDto } from '@workflex/shared';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AdminAuthService } from './admin-auth.service';

@ApiTags('admin')
@Controller('auth/admin')
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  /**
   * Public and throttled hard — this is a fixed, small set of accounts with
   * no lockout mechanism of its own, so the rate limit is the only thing
   * standing between this endpoint and a password-guessing script.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'Admin sign-in (email + password, not phone)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', example: 'susmita@admin.workflex.com.bd' },
        password: { type: 'string' },
      },
    },
  })
  async login(
    @Body(new ZodValidationPipe(adminLoginSchema)) dto: AdminLoginDto,
  ): Promise<AdminAuthTokens> {
    return this.adminAuth.login(dto.email, dto.password);
  }
}
