import { SubscriberType, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class ListSubscriptionsDto extends PaginationDto {
  @IsOptional() @IsEnum(SubscriptionPlan) plan?: SubscriptionPlan;
  @IsOptional() @IsEnum(SubscriptionStatus) status?: SubscriptionStatus;
  @IsOptional() @IsEnum(SubscriberType) subscriberType?: SubscriberType;
}

export class CreateSubscriptionDto {
  @IsEnum(SubscriberType) subscriberType!: SubscriberType;

  @ValidateIf((o) => o.subscriberType === SubscriberType.WORKER)
  @IsString()
  workerId?: string;

  @ValidateIf((o) => o.subscriberType === SubscriberType.EMPLOYER)
  @IsString()
  employerId?: string;

  @IsEnum(SubscriptionPlan) plan!: SubscriptionPlan;
  @IsOptional() @IsInt() @Min(0) price?: number;
  /// Days from now until this plan expires; omit for a plan that doesn't lapse.
  @IsOptional() @IsInt() @Min(1) durationDays?: number;
}

export class UpdateSubscriptionDto {
  @IsOptional() @IsEnum(SubscriptionPlan) plan?: SubscriptionPlan;
  @IsOptional() @IsEnum(SubscriptionStatus) status?: SubscriptionStatus;
}
