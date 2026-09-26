import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  adminLoginSchema,
  type AdminAuthTokens,
  type AdminLoginDto,
} from '@workflex/shared';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AdminAuthService } from '../admin/admin-auth.service';

/**
 * Sign-in for the console, at the path the console asks for.
 *
 * The work is the same service the API's own admin login uses — one Admin
 * table, one password check, one token — so this is only the door the console
 * knocks on, not a second way in.
 */
@ApiTags('console')
@Controller('console/auth')
export class ConsoleAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'Console sign-in (email + password)' })
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
