import { IsEnum, IsOptional } from 'class-validator';
import { SensorStatus } from '../../../entities/sensor.entity';

export class UpdateSensorDto {
  @IsEnum(SensorStatus)
  @IsOptional()
  status?: SensorStatus;
}