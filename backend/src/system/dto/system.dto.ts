import { IsString, MaxLength } from 'class-validator';

export class UpdateSettingDto {
  @IsString() @MaxLength(500) value!: string;
}
