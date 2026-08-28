import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { jobQuerySchema, type JobQuery } from '@workflex/shared';
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
  @Get('category-counts')
  @ApiOperation({ summary: 'Open listings per category' })
  async counts() {
    return this.jobs.categoryCounts();
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
}
