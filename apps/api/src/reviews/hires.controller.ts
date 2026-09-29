import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { hireListQuerySchema, type HireListQuery } from '@workflex/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { HiresService } from './hires.service';

@ApiTags('hires')
@ApiBearerAuth()
@Controller('hires')
export class HiresController {
  constructor(private readonly hires: HiresService) {}

  @Get()
  @ApiOperation({
    summary: 'Hires grouped by job: the people I hired, or the recruiters who hired me',
  })
  async list(
    @CurrentUser('userId') userId: string,
    @Query(new ZodValidationPipe(hireListQuerySchema)) query: HireListQuery,
  ) {
    return this.hires.list(userId, query.as);
  }

  @Post(':jobId/:workerId/complete')
  @ApiOperation({ summary: 'Recruiter confirms the job is finished for one hired person' })
  async complete(
    @CurrentUser('userId') userId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('workerId', ParseUUIDPipe) workerId: string,
  ) {
    return this.hires.complete(userId, jobId, workerId);
  }
}
