import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  IsOptional,
  Min,
  IsEnum,
} from 'class-validator';
import { TankType } from '../../../entities/tank.entity';

export class CreateTankDto {
  @IsString()
  @IsNotEmpty({ message: 'El código del tanque es requerido' })
  code: string;

  @IsEnum(TankType, { message: 'El tipo de tanque debe ser COMPANY o CLIENT' })
  @IsOptional()
  type?: TankType; // Por defecto será CLIENT

  @IsNumber()
  @Min(1, { message: 'La capacidad debe ser mayor a 0' })
  capacityLiters: number;

  @IsUUID('4', { message: 'El ID del cliente debe ser un UUID válido' })
  @IsOptional() // Solo requerido para tanques tipo CLIENT
  clientId?: string;

  @IsString()
  @IsOptional()
  location?: string;
}