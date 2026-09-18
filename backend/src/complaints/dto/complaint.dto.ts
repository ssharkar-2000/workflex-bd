import { ComplaintStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class ListComplaintsDto extends PaginationDto {
  @IsOptional() @IsEnum(ComplaintStatus) status?: ComplaintStatus;
}

export class UpdateComplaintDto {
  @IsOptional() @IsEnum(ComplaintStatus) status?: ComplaintStatus;
  @IsOptional() @IsString() @MaxLength(2000) resolution?: string;
}

export class ReplyComplaintDto {
  @IsString() @MinLength(1) @MaxLength(2000) message: string;
}
