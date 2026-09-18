import { DocumentKind } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ListDocumentsDto {
  @IsOptional() @IsString() workerId?: string;
  @IsOptional() @IsString() employerId?: string;
  @IsOptional() @IsString() jobId?: string;
  @IsOptional() @IsEnum(DocumentKind) kind?: DocumentKind;
  @IsOptional() @IsString() search?: string;
}

export class CreateDocumentDto {
  /// Exactly one of these — the service rejects both or neither.
  @IsOptional() @IsString() workerId?: string;
  @IsOptional() @IsString() employerId?: string;
  /// Optional: a document can belong to the user overall rather than one job.
  @IsOptional() @IsString() jobId?: string;

  @IsEnum(DocumentKind) kind: DocumentKind = DocumentKind.OTHER;
  @IsString() @MaxLength(200) fileName!: string;

  /// Where the bytes actually live. The storage *key* is always derived from
  /// user id + job id by the service and is never accepted from the client.
  @IsOptional() @IsString() @MaxLength(1000) url?: string;
  @IsOptional() @IsString() @MaxLength(120) mimeType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sizeBytes?: number;

  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
