import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  assignReplacementSchema,
  hireListQuerySchema,
  markUnavailableSchema,
  type AssignReplacementDto,
  type HireListQuery,
  type MarkUnavailableDto,
} from '@workflex/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { HireReplacementService } from './hire-replacement.service';
import { HiresService } from './hires.service';

@ApiTags('hires')
@ApiBearerAuth()
@Controller('hires')
export class HiresController {
  constructor(
    private readonly hires: HiresService,
    private readonly replacement: HireReplacementService,
  ) {}

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

  @Post(':jobId/:workerId/unavailable')
  @ApiOperation({
    summary: 'A hired worker cannot do the job: said by the worker, or by the recruiter who hired them',
  })
  async markUnavailable(
    @CurrentUser('userId') userId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('workerId', ParseUUIDPipe) workerId: string,
    @Body(new ZodValidationPipe(markUnavailableSchema)) dto: MarkUnavailableDto,
  ) {
    return this.replacement.markUnavailable(userId, jobId, workerId, dto);
  }

  @Delete(':jobId/:workerId/unavailable')
  @ApiOperation({ summary: 'The worker is available after all, until somebody has taken their place' })
  async markAvailable(
    @CurrentUser('userId') userId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('workerId', ParseUUIDPipe) workerId: string,
  ) {
    return this.replacement.markAvailable(userId, jobId, workerId);
  }

  @Get(':jobId/:workerId/replacements')
  @ApiOperation({
    summary: 'Replacement Matcher: the shortlisted candidates who could take this worker’s place',
  })
  async replacements(
    @CurrentUser('userId') userId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('workerId', ParseUUIDPipe) workerId: string,
  ) {
    return this.replacement.options(userId, jobId, workerId);
  }

  @Post(':jobId/:workerId/replace')
  @ApiOperation({ summary: 'Assign as Replacement: the chosen candidate becomes the hired worker' })
  async replace(
    @CurrentUser('userId') userId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('workerId', ParseUUIDPipe) workerId: string,
    @Body(new ZodValidationPipe(assignReplacementSchema)) dto: AssignReplacementDto,
  ) {
    return this.replacement.assign(userId, jobId, workerId, dto);
  }
}
