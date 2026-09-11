import { TransactionStatus, TransactionType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class ListTransactionsDto extends PaginationDto {
  @IsOptional() @IsEnum(TransactionStatus) status?: TransactionStatus;
  @IsOptional() @IsEnum(TransactionType) type?: TransactionType;
}

export class CreateRefundDto {
  @IsInt() @Min(1) amount!: number;
  @IsString() @MaxLength(500) reason!: string;
}
