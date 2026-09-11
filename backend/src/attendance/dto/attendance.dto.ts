import { AttendanceStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class ListAttendanceDto extends PaginationDto {
  @IsOptional() @IsEnum(AttendanceStatus) status?: AttendanceStatus;
  @IsOptional() @IsString() workerId?: string;
  /// ISO date (YYYY-MM-DD). Defaults to today when omitted.
  @IsOptional() @IsDateString() date?: string;
}

export class MarkAttendanceDto {
  @IsString() workerId!: string;
  @IsDateString() date!: string;
  @IsEnum(AttendanceStatus) status!: AttendanceStatus;
  @IsOptional() @IsString() jobId?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
