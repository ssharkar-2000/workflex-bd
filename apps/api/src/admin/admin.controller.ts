import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import {
  adminUserQuerySchema,
  changeAdminPasswordSchema,
  createNotificationSchema,
  maskPhone,
  respondTicketSchema,
  setUserStatusSchema,
  upsertContentSchema,
  type AdminUserQuery,
  type ChangeAdminPasswordDto,
  type CreateNotificationDto,
  type RespondTicketDto,
  type SetUserStatusDto,
  type UpsertContentDto,
} from '@workflex/shared';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AppException } from '../common/exceptions/app.exception';
import { SmsService } from '../sms/sms.service';
import { KycReviewService } from './kyc-review.service';
import { AdminDirectoryService } from './admin-directory.service';
import { AdminInsightsService } from './admin-insights.service';
import { AdminContentService } from './admin-content.service';

const rejectSchema = z.object({
  reason: z.string().trim().min(5, 'Give the applicant a usable reason').max(500),
});
type RejectDto = z.output<typeof rejectSchema>;

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly sms: SmsService,
    private readonly kyc: KycReviewService,
    private readonly directory: AdminDirectoryService,
    private readonly insights: AdminInsightsService,
    private readonly content: AdminContentService,
  ) {}

  // --- company management ---

  @Get('companies')
  @ApiOperation({ summary: 'Registered companies and their owners' })
  async companies(@Query('search') search?: string) {
    return this.insights.companies(search?.trim() || undefined);
  }

  // --- analytics ---

  @Get('analytics')
  @ApiOperation({ summary: 'Sign-up trend, account mix, verification funnel' })
  async analytics() {
    return this.insights.analytics();
  }

  // --- AI monitoring & fraud ---

  @Get('ai-monitoring')
  @ApiOperation({ summary: 'Automated document-check outcomes' })
  async aiMonitoring() {
    return this.insights.aiMonitoring();
  }

  @Get('fraud')
  @ApiOperation({ summary: 'Risk-scored accounts, with reasons' })
  async fraud() {
    return this.insights.fraud();
  }

  // --- security ---

  @Get('security')
  @ApiOperation({ summary: 'Sessions, suspended accounts, admin list' })
  async security() {
    return this.insights.security();
  }

  @Post('security/users/:id/revoke')
  @ApiOperation({ summary: 'Sign one person out of every device' })
  async revokeSessions(@Param('id') id: string) {
    return this.insights.revokeUserSessions(id);
  }

  // --- system ---

  @Get('system')
  @ApiOperation({ summary: 'Runtime, providers and table counts' })
  async system() {
    return this.insights.system();
  }

  // --- reports ---

  @Get('reports/summary')
  @ApiOperation({ summary: 'Platform summary, with a CSV copy' })
  async report() {
    return this.insights.report();
  }

  // --- notifications ---

  @Get('notifications')
  @ApiOperation({ summary: 'Published notices, newest first' })
  async notifications() {
    return this.content.notifications();
  }

  @Post('notifications')
  @ApiOperation({ summary: 'Publish a notice' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['title', 'body'],
      properties: {
        title: { type: 'string', example: 'Scheduled maintenance' },
        body: { type: 'string' },
        audience: {
          type: 'string',
          enum: ['ALL', 'WORKERS', 'EMPLOYERS'],
        },
      },
    },
  })
  async createNotification(
    @Body(new ZodValidationPipe(createNotificationSchema))
    dto: CreateNotificationDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.content.createNotification(dto, adminId);
  }

  @Delete('notifications/:id')
  @ApiOperation({ summary: 'Remove a notice' })
  async deleteNotification(@Param('id') id: string) {
    await this.content.deleteNotification(id);
    return { deleted: true };
  }

  // --- support ---

  @Get('support')
  @ApiOperation({ summary: 'Support tickets' })
  async tickets(@Query('status') status?: string) {
    return this.content.tickets(status);
  }

  @Patch('support/:id')
  @ApiOperation({ summary: 'Reply to a ticket and set its status' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['response'],
      properties: {
        response: { type: 'string' },
        status: {
          type: 'string',
          enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
        },
      },
    },
  })
  async respondToTicket(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(respondTicketSchema)) dto: RespondTicketDto,
    @CurrentUser('userId') adminId: string,
  ) {
    await this.content.respondToTicket(id, dto, adminId);
    return { updated: true };
  }

  // --- CMS ---

  @Get('content')
  @ApiOperation({ summary: 'Editable copy blocks' })
  async contentBlocks() {
    return this.content.content();
  }

  @Post('content')
  @ApiOperation({ summary: 'Create or update a copy block by key' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['key', 'title', 'body'],
      properties: {
        key: { type: 'string', example: 'terms.worker' },
        title: { type: 'string' },
        body: { type: 'string' },
        locale: { type: 'string', enum: ['bn', 'en'] },
      },
    },
  })
  async upsertContent(
    @Body(new ZodValidationPipe(upsertContentSchema)) dto: UpsertContentDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.content.upsertContent(dto, adminId);
  }

  @Delete('content/:key')
  @ApiOperation({ summary: 'Remove a copy block' })
  async deleteContent(@Param('key') key: string) {
    await this.content.deleteContent(key);
    return { deleted: true };
  }

  // --- attendance ---

  @Get('attendance')
  @ApiOperation({ summary: 'Shift check-ins' })
  async attendance(@Query('status') status?: string) {
    return this.content.attendance(status);
  }

  // --- settings ---

  @Patch('me/password')
  @ApiOperation({ summary: 'Change the signed-in admin password' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['currentPassword', 'newPassword', 'confirmPassword'],
      properties: {
        currentPassword: { type: 'string' },
        newPassword: { type: 'string' },
        confirmPassword: { type: 'string' },
      },
    },
  })
  async changePassword(
    @Body(new ZodValidationPipe(changeAdminPasswordSchema))
    dto: ChangeAdminPasswordDto,
    @CurrentUser('userId') adminId: string,
  ) {
    await this.content.changePassword(
      adminId,
      dto.currentPassword,
      dto.newPassword,
    );
    return { changed: true };
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Headline counts for the admin home screen' })
  async dashboard() {
    return this.directory.dashboard();
  }

  @Get('users')
  @ApiOperation({ summary: 'People directory — workers and employers' })
  async users(
    @Query(new ZodValidationPipe(adminUserQuerySchema)) query: AdminUserQuery,
  ) {
    return this.directory.users(query);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Activate or suspend an account' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] },
        reason: { type: 'string', example: 'Repeated no-shows' },
      },
    },
  })
  async setUserStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setUserStatusSchema)) dto: SetUserStatusDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.directory.setStatus(id, dto.status, adminId, dto.reason);
  }

  /**
   * Read back codes that were never actually delivered, so identity can be
   * checked during development without an SMS account.
   *
   * This is a testing aid, not verification: it proves only that an admin can
   * read the code, never that the person signing in holds the SIM.
   */
  @Get('sms/outbox')
  @ApiOperation({ summary: 'Recent undelivered SMS (dev providers only)' })
  outbox(@CurrentUser('userId') adminId: string) {
    if (!this.sms.isDevProvider) {
      throw AppException.notFound('Not found');
    }

    const messages = this.sms.getDevOutbox();
    this.logger.warn(
      { adminId, count: messages.length },
      'Admin read the development SMS outbox',
    );

    return {
      warning:
        'These codes were never sent. This endpoint is a development aid and does not verify phone ownership.',
      messages: messages.map((m) => ({
        phone: m.phone,
        maskedPhone: maskPhone(m.phone),
        code: m.code,
        sentAt: m.sentAt,
      })),
    };
  }

  @Get('kyc/queue')
  @ApiOperation({ summary: 'Applications waiting for review, oldest first' })
  async queue() {
    return this.kyc.queue();
  }

  @Get('kyc/:userId/documents/:kind')
  @ApiOperation({ summary: "Fetch one of an applicant's documents" })
  async document(
    @Param('userId') userId: string,
    @Param('kind') kind: string,
    @CurrentUser('userId') adminId: string,
    @Res() res: Response,
  ): Promise<void> {
    const doc = await this.kyc.document(userId, kind, adminId);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(doc.data);
  }

  @Post('kyc/:id/approve')
  @ApiOperation({ summary: 'Approve an application and raise its level' })
  async approve(
    @Param('id') id: string,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.kyc.approve(id, adminId);
  }

  @Post('kyc/:id/reject')
  @ApiOperation({ summary: 'Reject with a reason the applicant can act on' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['reason'],
      properties: {
        reason: {
          type: 'string',
          example: 'The back of the NID is blurred. Please upload a clearer photo.',
        },
      },
    },
  })
  async reject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectSchema)) dto: RejectDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.kyc.reject(id, adminId, dto.reason);
  }
}
