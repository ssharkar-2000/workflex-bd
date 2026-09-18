import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingDto {
  @IsString() @MaxLength(500) value!: string;
}

export class CreateMaintenanceDto {
  @IsString() @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(1000) message?: string;
  /// ISO datetime — must be in the future (checked in the service).
  @IsDateString() scheduledAt!: string;
}
