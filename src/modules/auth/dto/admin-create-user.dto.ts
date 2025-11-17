import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { UserRole } from '../../../entities/user.entity';
import { IdentificationType } from '../../../entities/client.entity';

export class AdminCreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole = UserRole.CLIENT; // Default to CLIENT

  @IsString()
  @IsOptional()
  companyName?: string;

  @IsEnum(IdentificationType)
  identificationType: IdentificationType;

  @IsString()
  @IsNotEmpty()
  identificationNumber: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  phone: string;
}