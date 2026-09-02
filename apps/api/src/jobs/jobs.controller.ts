import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  applyToJobSchema,
  createJobSchema,
  jobQuerySchema,
  type ApplyToJobDto,
  type CreateJobDto,
  type JobQuery,
} from '@workflex/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JobsService } from './jobs.service';

@ApiTags('jobs')
@ApiBearerAuth()
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @ApiOperation({ summary: 'Open listings, filtered and paged' })
  async list(
    @CurrentUser('userId') userId: string,
    @Query(new ZodValidationPipe(jobQuerySchema)) query: JobQuery,
  ) {
    return this.jobs.list(userId, query);
  }

  /**
   * Separate from the list so the filter row can render its counts without
   * waiting on a page of results, and keep them while the list refetches.
   */
  /**
   * Declared before `:id` — Nest matches routes in order, so a dynamic
   * segment placed first would treat "highlights" as a job id.
   */
  @Get('highlights')
  @ApiOperation({ summary: 'Headline counts and the most urgent listings' })
  async highlights(@CurrentUser('userId') userId: string) {
    return this.jobs.highlights(userId);
  }

  @Get('category-counts')
  @ApiOperation({ summary: 'Open listings per category' })
  async counts() {
    return this.jobs.categoryCounts();
  }

  // --- posting ---
  //
  // Declared before `:id` for the same reason as the routes above: Nest
  // matches in order, and a dynamic segment first would swallow "mine".

  @Get('mine')
  @ApiOperation({ summary: 'Jobs this account has posted' })
  async mine(@CurrentUser('userId') userId: string) {
    return this.jobs.mine(userId);
  }

  @Get('applications')
  @ApiOperation({ summary: 'Jobs this account has applied to' })
  async myApplications(@CurrentUser('userId') userId: string) {
    return this.jobs.myApplications(userId);
  }

  @Get('recommended')
  @ApiOperation({ summary: 'Personalised suggestions for the dashboard' })
  async recommended(@CurrentUser('userId') userId: string) {
    return this.jobs.recommended(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Post a job as yourself or as your company' })
  async create(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(createJobSchema)) dto: CreateJobDto,
  ) {
    return this.jobs.create(userId, dto);
  }

  @Patch(':id/open')
  @ApiOperation({ summary: 'Reopen or close one of your own postings' })
  async setOpen(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { isOpen?: unknown },
  ) {
    return this.jobs.setOpen(userId, id, body.isOpen !== false);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One listing' })
  async byId(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobs.byId(userId, id);
  }

  @Post(':id/save')
  @ApiOperation({ summary: 'Bookmark or un-bookmark a listing' })
  async toggleSaved(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobs.toggleSaved(userId, id);
  }

  @Post(':id/apply')
  @ApiOperation({ summary: 'Apply to a listing' })
  async apply(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(applyToJobSchema)) dto: ApplyToJobDto,
  ) {
    return this.jobs.apply(userId, id, dto);
  }

  @Delete(':id/apply')
  @ApiOperation({ summary: 'Withdraw an application' })
  async withdraw(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobs.withdraw(userId, id);
  }
}
