import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  applyToJobSchema,
  createJobSchema,
  applyShortlistSchema,
  decideApplicationSchema,
  type ApplyShortlistDto,
  jobDraftRequestSchema,
  jobQuerySchema,
  nearbyQuerySchema,
  type ApplyToJobDto,
  type CreateJobDto,
  type DecideApplicationDto,
  type JobDraftRequestDto,
  type JobQuery,
  type NearbyQuery,
} from '@workflex/shared';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ApplyDraftService } from './apply-draft.service';
import { JobDraftService } from './job-draft.service';
import { VolunteerIdeasService } from './volunteer-ideas.service';
import { InternshipIdeasService } from './internship-ideas.service';
import { DemandMapService } from './demand-map.service';
import { ShortlistService } from './shortlist.service';
import { SkillTrendsService } from './skill-trends.service';
import { OpportunityService } from './opportunity.service';
import { JobsService } from './jobs.service';

@ApiTags('jobs')
@ApiBearerAuth()
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly drafts: JobDraftService,
    private readonly applyDrafts: ApplyDraftService,
    private readonly volunteering: VolunteerIdeasService,
    private readonly internships: InternshipIdeasService,
    private readonly demandMap: DemandMapService,
    private readonly shortlist: ShortlistService,
    private readonly skillTrends: SkillTrendsService,
    private readonly opportunity: OpportunityService,
  ) {}

  @Post('draft')
  @ApiOperation({
    summary: "Turn a sentence into a job posting the employer can edit",
  })
  async draft(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(jobDraftRequestSchema)) dto: JobDraftRequestDto,
  ) {
    return this.drafts.draft(userId, dto);
  }

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
  @Get('volunteer-ideas')
  @ApiOperation({
    summary: 'Kinds of volunteering to look for, as searches — never events',
  })
  async volunteerIdeas(@CurrentUser('userId') userId: string) {
    return this.volunteering.ideas(userId);
  }

  /** Static segment, so it too must stay above `:id`. */
  @Get('internship-ideas')
  @ApiOperation({
    summary: 'Kinds of internship to look for, as searches — never vacancies',
  })
  async internshipIdeas(@CurrentUser('userId') userId: string) {
    return this.internships.ideas(userId);
  }

  /** Static segment, so it too must stay above `:id`. */
  @Get('demand-map')
  @ApiOperation({
    summary: 'Open vacancies against available workers, by division',
  })
  async demandMapData(@CurrentUser('userId') userId: string) {
    return this.demandMap.map(userId);
  }

  /** Static segment, so it too must stay above `:id`. */
  @Get('skill-trends')
  @ApiOperation({
    summary: 'Which skills postings are asking for more of than last month',
  })
  async skillTrendsData(@CurrentUser('userId') userId: string) {
    return this.skillTrends.trends(userId);
  }

  /** Static segment, so it too must stay above . */
  @Get('opportunity')
  @ApiOperation({ summary: 'The strongest local opportunity, or nothing' })
  async opportunityNearby(@CurrentUser('userId') userId: string) {
    return this.opportunity.nearby(userId);
  }

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

  @Get('nearby')
  @ApiOperation({ summary: 'Open work near the viewer, with distances' })
  @ApiQuery({ name: 'lat', required: false, type: Number })
  @ApiQuery({ name: 'lng', required: false, type: Number })
  @ApiQuery({ name: 'radiusKm', required: false, type: Number })
  async nearby(
    @CurrentUser('userId') userId: string,
    @Query(new ZodValidationPipe(nearbyQuerySchema)) query: NearbyQuery,
  ) {
    // Both or neither. Half a coordinate is not a position, and silently
    // treating lat-with-no-lng as "somewhere on the prime meridian" would put
    // the person in the Atlantic.
    const origin =
      query.lat !== undefined && query.lng !== undefined
        ? { lat: query.lat, lng: query.lng }
        : null;
    return this.jobs.nearby(userId, origin, query.radiusKm);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Work this account has been accepted for' })
  async upcoming(@CurrentUser('userId') userId: string) {
    return this.jobs.upcoming(userId);
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

  @Get(':id/applicants/:userId/cv')
  @ApiOperation({ summary: "Open an applicant's CV (the job's poster only)" })
  async applicantCv(
    @CurrentUser('userId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) applicantId: string,
    @Res() res: Response,
  ): Promise<void> {
    const doc = await this.jobs.applicantDocument(ownerId, id, applicantId, 'CV');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(doc.data);
  }

  @Get(':id/applicants/:userId/intro')
  @ApiOperation({
    summary: "Watch an applicant's video introduction (the job's poster only)",
  })
  async applicantIntro(
    @CurrentUser('userId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) applicantId: string,
    @Res() res: Response,
  ): Promise<void> {
    const doc = await this.jobs.applicantDocument(
      ownerId,
      id,
      applicantId,
      'INTRO_VIDEO',
    );
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(doc.data);
  }

  @Post(':id/apply-draft')
  @ApiOperation({
    summary: 'One-Click Apply: the application note, from the CV and profile',
  })
  async applyDraft(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.applyDrafts.draft(userId, id);
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

  // --- the poster's side ---

  @Get(':id/applicants')
  @ApiOperation({ summary: 'Applicants to one of your postings' })
  async applicants(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobs.applicants(userId, id);
  }

  @Get(':id/shortlist')
  @ApiOperation({
    summary: 'The strongest applicants, ranked against what the posting asks for',
  })
  async shortlistFor(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shortlist.build(userId, id);
  }

  @Post(':id/shortlist/apply')
  @ApiOperation({ summary: 'Put the AI shortlist on the shortlist in one tap' })
  async applyShortlist(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(applyShortlistSchema)) dto: ApplyShortlistDto,
  ) {
    return this.shortlist.apply(userId, id, dto.userIds);
  }

  @Patch(':id/applicants/:userId')
  @ApiOperation({ summary: 'Shortlist, hire or turn down an applicant' })
  async decide(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) applicantId: string,
    @Body(new ZodValidationPipe(decideApplicationSchema)) dto: DecideApplicationDto,
  ) {
    return this.jobs.decide(userId, id, applicantId, dto);
  }
}
