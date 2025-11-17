import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsNumber()
  @Min(5, { message: 'El umbral mínimo es 5%' })
  @Max(50, { message: 'El umbral máximo es 50%' })
  @IsOptional()
  lowGasThreshold?: number;

  @IsNumber()
  @Min(1, { message: 'El umbral crítico mínimo es 1%' })
  @Max(30, { message: 'El umbral crítico máximo es 30%' })
  @IsOptional()
  criticalGasThreshold?: number;

  @IsBoolean()
  @IsOptional()
  emailNotifications?: boolean;

  @IsEmail({}, { message: 'El correo de notificaciones no es válido' })
  @IsOptional()
  notificationEmail?: string;
}