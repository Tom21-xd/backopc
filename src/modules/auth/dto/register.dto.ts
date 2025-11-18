import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { IdentificationType } from '../../../entities/user.entity';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido es requerido' })
  lastName: string;

  @IsEnum(IdentificationType, { message: 'Tipo de identificación inválido' })
  @IsNotEmpty({ message: 'El tipo de identificación es requerido' })
  identificationType: IdentificationType;

  @IsString()
  @IsNotEmpty({ message: 'El número de identificación es requerido' })
  identificationNumber: string;

  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  companyName?: string; // Nombre de la empresa (opcional)

  @IsString()
  @IsOptional()
  address?: string;
}