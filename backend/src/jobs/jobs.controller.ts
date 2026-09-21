import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CreateJobCategoryDto, CreateJobDto, ListJobsDto, RejectJobDto, UpdateJobDto } from './dto/job.dto';
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CreateJobDto, ListJobsDto, RejectJobDto, UpdateJobDto } from './dto/job.dto';
import { JobsService } from './jobs.service';

type Admin = { id: string };

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  list(@Query() query: ListJobsDto) {
    return this.jobs.list(query);
  }

  @Get('status-counts')
  statusCounts() {
    return this.jobs.statusCounts();
  }

  @Get('categories')
  categories() {
    return this.jobs.categories();
  }

  /// Lets the poster type a category that isn't in the preset list instead
  /// of being limited to it. See JobsService.createCategory().
  @Post('categories')
  createCategory(@Body() dto: CreateJobCategoryDto, @CurrentUser() admin: Admin) {
    return this.jobs.createCategory(dto, admin.id);
  }

  @Get('companies')
  companies() {
    return this.jobs.companies();
  }

  @Get('analytics')
  analytics() {
    return this.jobs.analytics();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobs.findOne(id);
  }

  /// Item 23 follow-up — see JobsService.applications().
  @Get(':id/applications')
  applications(@Param('id') id: string) {
    return this.jobs.applications(id);
  }

  @Post(':id/applications/:applicationId/shortlist')
  shortlistApplication(
    @Param('id') id: string,
    @Param('applicationId') applicationId: string,
    @CurrentUser() admin: Admin,
  ) {
    return this.jobs.setApplicationStatus(id, applicationId, ApplicationStatus.SHORTLISTED, admin.id);
  }

  @Post(':id/applications/:applicationId/hire')
  hireApplication(
    @Param('id') id: string,
    @Param('applicationId') applicationId: string,
    @CurrentUser() admin: Admin,
  ) {
    return this.jobs.setApplicationStatus(id, applicationId, ApplicationStatus.HIRED, admin.id);
  }

  @Post(':id/applications/:applicationId/reject')
  rejectApplication(
    @Param('id') id: string,
    @Param('applicationId') applicationId: string,
    @CurrentUser() admin: Admin,
  ) {
    return this.jobs.setApplicationStatus(id, applicationId, ApplicationStatus.REJECTED, admin.id);
  }

  @Post()
  create(@Body() dto: CreateJobDto, @CurrentUser() admin: Admin) {
    return this.jobs.create(dto, admin.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateJobDto, @CurrentUser() admin: Admin) {
    return this.jobs.update(id, dto, admin.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() admin: Admin) {
    return this.jobs.remove(id, admin.id);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() admin: Admin) {
    return this.jobs.approve(id, admin.id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectJobDto, @CurrentUser() admin: Admin) {
    return this.jobs.reject(id, dto.reason, admin.id);
  }

  @Post(':id/feature')
  feature(@Param('id') id: string, @CurrentUser() admin: Admin) {
    return this.jobs.setFeatured(id, true, admin.id);
  }

  @Post(':id/unfeature')
  unfeature(@Param('id') id: string, @CurrentUser() admin: Admin) {
    return this.jobs.setFeatured(id, false, admin.id);
  }
}
