import { Availability, WorkerStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class ListWorkersDto extends PaginationDto {
  @IsOptional()
  @IsEnum(WorkerStatus)
  status?: WorkerStatus;

  @IsOptional()
  @IsString()
  profession?: string;
}

export class UpdateWorkerDto {
  @IsOptional() @IsString() @MaxLength(120) fullName?: string;
  @IsOptional() @IsString() @MaxLength(80) profession?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(240) address?: string;
  @IsOptional() @IsString() @MaxLength(1000) bio?: string;
  @IsOptional() @IsString() @MaxLength(240) education?: string;
  @IsOptional() @IsEnum(Availability) availability?: Availability;
  @IsOptional() @IsInt() @Min(0) experienceMonths?: number;
  @IsOptional() @IsInt() @Min(0) salaryMin?: number;
  @IsOptional() @IsInt() @Min(0) salaryMax?: number;
  @IsOptional() @IsString({ each: true }) skills?: string[];
}

export class SuspendWorkerDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}
