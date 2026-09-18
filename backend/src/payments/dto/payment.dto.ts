import { TransactionStatus, TransactionType } from '@prisma/client';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class ListTransactionsDto extends PaginationDto {
  @IsOptional() @IsEnum(TransactionStatus) status?: TransactionStatus;
  @IsOptional() @IsEnum(TransactionType) type?: TransactionType;
  /// Lets a screen ask "every transaction for this worker" (Worker Profile ->
  /// full transaction history) instead of only the global admin feed.
  @IsOptional() @IsString() workerId?: string;
  @IsOptional() @IsString() employerId?: string;
  @IsOptional() @IsString() jobId?: string;
  /// 'desc' (default, newest first) or 'asc' (oldest first — "1st to last").
  @IsOptional() @IsIn(['asc', 'desc']) sort?: 'asc' | 'desc';
}

export class CreateRefundDto {
  @IsInt() @Min(1) amount!: number;
  @IsString() @MaxLength(500) reason!: string;
}
