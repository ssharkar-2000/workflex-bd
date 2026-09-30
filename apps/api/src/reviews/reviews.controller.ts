import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  createReviewSchema,
  reviewRoleSchema,
  type CreateReviewDto,
} from '@workflex/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ReviewsService } from './reviews.service';

const roleQuerySchema = z.object({ role: reviewRoleSchema.default('WORKER') });
type RoleQuery = z.output<typeof roleQuerySchema>;

@ApiTags('reviews')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Ratings, reviews received and reviews given, for one role' })
  async page(
    @CurrentUser('userId') userId: string,
    @Query(new ZodValidationPipe(roleQuerySchema)) query: RoleQuery,
  ) {
    return this.reviews.page(userId, query.role);
  }

  @Post()
  @ApiOperation({ summary: 'Review someone you shared a job with' })
  async create(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(createReviewSchema)) dto: CreateReviewDto,
  ) {
    return this.reviews.create(userId, dto);
  }
}
