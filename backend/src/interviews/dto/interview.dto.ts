import { InterviewMode, InterviewStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class ListInterviewsDto extends PaginationDto {
  @IsOptional() @IsEnum(InterviewStatus) status?: InterviewStatus;
  @IsOptional() @IsString() jobId?: string;
  @IsOptional() @IsString() workerId?: string;
  /// ISO dates; used by the "Today" tab and any range filter.
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class CreateInterviewDto {
  @IsString() jobId!: string;
  @IsString() workerId!: string;
  @IsOptional() @IsString() applicationId?: string;

  @IsDateString() scheduledAt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes?: number;

  @IsOptional() @IsEnum(InterviewMode) mode?: InterviewMode;
  /// Address for IN_PERSON, meeting link for VIDEO, number for PHONE.
  @IsOptional() @IsString() @MaxLength(500) location?: string;
  @IsOptional() @IsString() @MaxLength(140) interviewerName?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateInterviewDto {
  @IsOptional() @IsDateString() scheduledAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes?: number;

  @IsOptional() @IsEnum(InterviewMode) mode?: InterviewMode;
  @IsOptional() @IsEnum(InterviewStatus) status?: InterviewStatus;
  @IsOptional() @IsString() @MaxLength(500) location?: string;
  @IsOptional() @IsString() @MaxLength(140) interviewerName?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsString() @MaxLength(2000) outcome?: string;
}

export class CancelInterviewDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
