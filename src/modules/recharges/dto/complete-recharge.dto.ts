import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CompleteRechargeDto {
  @IsNumber()
  @Min(1)
  actualQuantityLiters: number;

  @IsString()
  @IsOptional()
  notes?: string;
}