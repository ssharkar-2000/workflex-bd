import { BanStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class ListBansDto extends PaginationDto {
  @IsOptional() @IsEnum(BanStatus) status?: BanStatus;
  @IsOptional() @IsString() workerId?: string;
}

export class ScheduleBanDto {
  @IsString() workerId!: string;

  /// Admin-facing justification. Goes into the audit log.
  @IsString() @MinLength(10) @MaxLength(500) reason!: string;

  /// Item 8: "ban korar 24h age akta notification with text" — this is that
  /// text. Optional; a default notice is composed from the reason when the
  /// admin doesn't write one.
  @IsOptional() @IsString() @MaxLength(1000) noticeText?: string;

  /// The transaction that prompted the review, when the admin started from
  /// the irregular-transactions list.
  @IsOptional() @IsString() triggerTransactionId?: string;
}

export class CancelBanDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
