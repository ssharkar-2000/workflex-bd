import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendSupportMessageDto {
  /// Omit to open a new ticket; pass it to add to an existing thread.
  @IsOptional() @IsString() complaintId?: string;

  @IsString() @MinLength(1) @MaxLength(2000) message!: string;

  @IsOptional() @IsString() @MaxLength(140) subject?: string;
  @IsOptional() @IsString() @MaxLength(140) reporterName?: string;

  /// Who to send the reply back to. One of these, or neither for a guest.
  @IsOptional() @IsString() workerId?: string;
  @IsOptional() @IsString() employerId?: string;
}
