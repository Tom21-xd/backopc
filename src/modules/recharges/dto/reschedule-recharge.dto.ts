import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RescheduleRechargeDto {
  @IsDateString()
  @IsNotEmpty({ message: 'La nueva fecha es requerida' })
  newScheduledDate: string;

  @IsString()
  @IsOptional()
  rescheduledReason?: string;
}