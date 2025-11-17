import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'email', 'role'] as const),
) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}