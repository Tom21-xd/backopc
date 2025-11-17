import {
  IsUUID,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsDateString,
} from 'class-validator';

export class CreateSupplyDto {
  @IsUUID('4')
  @IsNotEmpty({ message: 'El tanque es requerido' })
  tankId: string;

  @IsNumber()
  @Min(1, { message: 'La cantidad debe ser mayor a 0' })
  quantityLiters: number;

  @IsDateString()
  @IsOptional()
  supplyDate?: string;

  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  cost?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}