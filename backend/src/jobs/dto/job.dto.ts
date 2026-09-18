import { Availability, JobStatus, JobUrgency } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class ListJobsDto extends PaginationDto {
  @IsOptional() @IsEnum(JobStatus) status?: JobStatus;
  @IsOptional() @IsString() category?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  featured?: boolean;
}

export class CreateJobDto {
  @IsString() @MaxLength(140) title!: string;
  @IsString() @MaxLength(4000) description!: string;
  @IsString() companyId!: string;
  @IsString() categoryId!: string;
  @IsString() @MaxLength(240) location!: string;
  @IsInt() @Min(0) salaryMin!: number;
  @IsInt() @Min(0) salaryMax!: number;
  @IsOptional() @IsEnum(Availability) availability?: Availability;
  @IsOptional() @IsInt() @Min(0) experienceMonths?: number;
  @IsOptional() @IsEnum(JobUrgency) urgency?: JobUrgency;
}

export class UpdateJobDto {
  @IsOptional() @IsString() @MaxLength(140) title?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsString() @MaxLength(240) location?: string;
  @IsOptional() @IsInt() @Min(0) salaryMin?: number;
  @IsOptional() @IsInt() @Min(0) salaryMax?: number;
  @IsOptional() @IsEnum(Availability) availability?: Availability;
  @IsOptional() @IsInt() @Min(0) experienceMonths?: number;
  @IsOptional() @IsEnum(JobUrgency) urgency?: JobUrgency;
  @IsOptional() @IsString() categoryId?: string;
}

export class RejectJobDto {
  @IsString() @MaxLength(500) reason!: string;
}
