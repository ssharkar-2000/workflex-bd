import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

/// `forbidNonWhitelisted: true` is on globally, so any query param not
/// declared here is rejected with a 400 rather than silently ignored —
/// which is what was happening before entityType/entityId/action existed
/// on this DTO: filtering by them from any caller would have failed
/// validation before it ever reached the service.
export class AuditLogQueryDto extends PaginationDto {
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsString() entityId?: string;
}
