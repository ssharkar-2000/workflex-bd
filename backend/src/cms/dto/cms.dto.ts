import { CmsBlockKind } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class ListCmsDto extends PaginationDto {
  @IsOptional() @IsEnum(CmsBlockKind) kind?: CmsBlockKind;
}

export class CreateCmsBlockDto {
  @IsEnum(CmsBlockKind) kind!: CmsBlockKind;
  @IsString() @MaxLength(80) slug!: string;
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(200) titleBn?: string;
  @IsOptional() @IsString() @MaxLength(8000) body?: string;
  @IsOptional() @IsString() @MaxLength(8000) bodyBn?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsInt() @Min(0) position?: number;
}

export class UpdateCmsBlockDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(200) titleBn?: string;
  @IsOptional() @IsString() @MaxLength(8000) body?: string;
  @IsOptional() @IsString() @MaxLength(8000) bodyBn?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsInt() @Min(0) position?: number;
  @IsOptional() @IsBoolean() published?: boolean;
}
