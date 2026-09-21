import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class ListCompaniesDto extends PaginationDto {
  @IsOptional() @IsString() industry?: string;
}

export class CreateCompanyDto {
  @IsString() @MaxLength(140) name!: string;
  @IsOptional() @IsString() @MaxLength(80) industry?: string;
  @IsOptional() @IsString() @MaxLength(240) address?: string;
}

export class UpdateCompanyDto {
  @IsOptional() @IsString() @MaxLength(140) name?: string;
  @IsOptional() @IsString() @MaxLength(80) industry?: string;
  @IsOptional() @IsString() @MaxLength(240) address?: string;
  @IsOptional() @IsBoolean() verified?: boolean;
}
