import { Availability, JobStatus, JobUrgency } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
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
  /// Item 7: this text is sent to the employer as written, so a blank or
  /// throwaway reason is rejected here as well as in JobsService.reject().
  @IsString() @MinLength(10) @MaxLength(500) reason!: string;
}

/// Lets the person posting a job type a category that isn't in the preset
/// list, instead of being limited to whatever was seeded.
export class CreateJobCategoryDto {
  @IsString() @MaxLength(80) name!: string;
  /// A single emoji shown as the chip icon. Defaults to a generic briefcase
  /// when the caller doesn't send one, so the category still renders fine.
  @IsOptional() @IsString() @MaxLength(8) icon?: string;
}
