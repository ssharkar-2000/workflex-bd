import { ComplaintStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class ListComplaintsDto extends PaginationDto {
  @IsOptional() @IsEnum(ComplaintStatus) status?: ComplaintStatus;
}

export class UpdateComplaintDto {
  @IsOptional() @IsEnum(ComplaintStatus) status?: ComplaintStatus;
  @IsOptional() @IsString() @MaxLength(2000) resolution?: string;
}
