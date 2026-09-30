import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  startMockTestSchema,
  submitMockTestSchema,
  type StartMockTestDto,
  type SubmitMockTestDto,
} from '@workflex/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { MockTestsService } from './mock-tests.service';

@ApiTags('mock-tests')
@ApiBearerAuth()
@Controller('mock-tests')
export class MockTestsController {
  constructor(private readonly tests: MockTestsService) {}

  /** Static segments first, as everywhere else: `:id` would swallow them. */
  @Get('subjects')
  @ApiOperation({ summary: 'What can be practised, and what suits this account' })
  async subjects(@CurrentUser('userId') userId: string) {
    return this.tests.subjects(userId);
  }

  @Get('progress')
  @ApiOperation({ summary: 'Tests taken, average score and what improved' })
  async progress(@CurrentUser('userId') userId: string) {
    return this.tests.progress(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Generate a test and start the clock' })
  async start(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(startMockTestSchema)) dto: StartMockTestDto,
  ) {
    return this.tests.start(userId, dto);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Mark the answers and return the feedback' })
  async submit(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(submitMockTestSchema)) dto: SubmitMockTestDto,
  ) {
    return this.tests.submit(userId, id, dto);
  }

  @Get(':id/result')
  @ApiOperation({ summary: 'A finished test read back' })
  async result(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tests.result(userId, id);
  }
}
