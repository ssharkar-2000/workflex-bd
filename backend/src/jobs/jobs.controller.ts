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

  @Post()
  create(@Body() dto: CreateJobDto, @CurrentUser() admin: Admin) {
    return this.jobs.create(dto, admin.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateJobDto, @CurrentUser() admin: Admin) {
    return this.jobs.update(id, dto, admin.id);
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
