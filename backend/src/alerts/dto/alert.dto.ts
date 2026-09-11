import { AlertSeverity, AlertStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class ListAlertsDto extends PaginationDto {
  @IsOptional() @IsEnum(AlertStatus) status?: AlertStatus;
  @IsOptional() @IsEnum(AlertSeverity) severity?: AlertSeverity;
}

export class ResolveAlertDto {
  @IsString() @MaxLength(500) actionTaken!: string;
}

export class EscalateAlertDto {
  @IsOptional() @IsString() @MaxLength(500) actionTaken?: string;
}
