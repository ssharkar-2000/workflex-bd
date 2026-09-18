import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class ListEmployersDto extends PaginationDto {
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsIn(['true', 'false']) verified?: string;
}

export class CreateEmployerDto {
  @IsString() @MaxLength(120) fullName!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() companyId?: string;
}

export class UpdateEmployerDto {
  @IsOptional() @IsString() @MaxLength(120) fullName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsBoolean() verified?: boolean;
}
