import {
  IsUUID,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateRechargeDto {
  @IsUUID('4')
  @IsNotEmpty({ message: 'El tanque es requerido' })
  tankId: string;

  @IsDateString()
  @IsNotEmpty({ message: 'La fecha programada es requerida' })
  scheduledDate: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  estimatedQuantityLiters?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}