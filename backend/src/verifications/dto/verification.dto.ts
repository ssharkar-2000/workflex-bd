import { VerificationStatus, VerificationType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class ListVerificationsDto extends PaginationDto {
  @IsOptional() @IsEnum(VerificationStatus) status?: VerificationStatus;
  @IsOptional() @IsEnum(VerificationType) type?: VerificationType;
}

export class ReviewVerificationDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
